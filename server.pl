#!/usr/bin/perl
#
# Sets metadata about media (movie, pic) files, by using Exiftool.
# (Actually, exiftool works on all kinds of files, but media is what I'm interested in.)
#
# NOTES:
#
# Had what I thought were multithreading issues with HTTP::Daemon module,
# discovered many other web servers, and decided on Mojolicious
# because of how clean and easy it is to implement.
# Mojo is MVC, but using MV only (view in __DATA__ at bottom)
# with only one view variable (config) for the client to access.
#
# Couldn't get Perlmagick modules installed,
# so thumbnails are generated with the CLI of Imagemagick.
#
# Although client-server, intended as local app only; otherwise
# token is exposed without SSL.

use strict;
use warnings;
use utf8;
use feature ':5.16';

my $debug = 1;

use File::Copy;
use File::Basename;
use Image::ExifTool qw( :Public );
use MIME::Base64;
use Mojolicious::Lite -signatures;
use POSIX;


# ---------------------------------------------------
# get config for Perl _and_ JS app (embedded in HTML)
# ---------------------------------------------------

my $config_json = '';
open F, "config.json" or die "Cannot open config. $!";
{
  local $/ = undef;
  $config_json = <F>;
  $config_json =~ s/\s+/ /g;
}
close F;
my $config = plugin JSONConfig => { file => 'config.json' };


# ----------
# web server
# ----------

# don't cache static files (css, js, images) -- particularly during development, sheesh

plugin 'StaticCache' => { cache_control => 'no-cache', max_age => 0 };
push @{app->static->paths}, 'public';

# routes (API)

get '/' => sub ($c) {
  # main app
  # (adds config as JSON to the HTML page for access by client)
  $c->stash(config_json => $config_json);
  $c->stash(timezone => strftime("%Z", localtime()));
  $c->render(template => 'index');
};

post '/getexif' => sub ($c) {
  # return the EXIF data for provided array of files
  # (note how requests want references, not arrays)
  my $filesref = $c->req->json;
  my $exifref = getExifInfo($filesref);
  $c->render(json => $exifref);
};

post '/fileexist' => sub ($c) {
  # file exist test to see if client has the right path
  # (using plain text body to avoid JSON backslashes and dereferencing)
  my $fullpath = $c->req->body;
  my $json = ( -f $fullpath ? 1 : 0 );
  $c->render(json => $json);
};

post '/changefiles' => sub ($c) {
  # write EXIF and rename files from client's JSON data
  my $dataref = $c->req->json;
  my $respref = changeFiles($dataref);
  $c->render(json => $respref);
};

# launch

#app->start('threaded', '-l', 'http://localhost:8989');
app->start('daemon', '-l', 'http://localhost:8989');


# ---------------
# sub definitions
# ---------------

sub getFileParts
{
  my ($fullname) = @_;
  my ($base, $path) = fileparse($fullname);
  my $ext = '';
  if ($base =~ /^(.*)\.(.*)$/) { $base = $1; $ext = '.'. $2; }
  return ($path, $base, $ext);
}

sub getThumb64
{
  my ($f) = @_;

  my $cmd = $config->{'convertcmd'};

  my $ext = ''; if ($f =~ /\.(.*)$/) { $ext = $1; }
  $f .= ($f =~ /\.(?:i)(bmp|jpg|jpeg|png|gif|tiff?)$/ ? '' : '[10]');

  my $f64 = '';
  if (open(FILE, qq("$cmd" "$f" -resize 140x140 jpeg:- |))) {
    binmode(FILE);
    {
      local $/ = undef;
      $f64 .= encode_base64(<FILE>, '');
    }
    close FILE;
    #print $f64;
  } else {
    warn "Couldn't convert $f.\n$!";
  }
  return qq(data:image/jpeg;base64,).$f64;
}

sub getExifInfo
{
  my ($filesref) = @_;

  my @exif = ();
  # array, not arrayref, because perl warning "push to reference is experimental",
  # and writing "$exif->[++$#{$exif}] = $i" is nuts ...
  for (@{$filesref}) {
    my $eto = new Image::ExifTool;
    $eto->Options(CoordFormat => '%+.6f');
    my $info = $eto->ImageInfo($_);
    my $img64 = getThumb64($_);
    my ($path, $base, $ext) = getFileParts($_);
    my $i = {};
    $i->{'FileName'} = $info->{'FileName'};
    $i->{'thumb'} = $img64;
    $i->{'Name'} = ${base}.$ext;
    $i->{'Title'} = $info->{'Title'} ? $info->{'Title'} : '';
    $i->{'DateTimeOriginal'} = $info->{'DateTimeOriginal'} ? $info->{'DateTimeOriginal'} : '';
    $i->{'ModifyDate'} = $info->{'ModifyDate'} ? $info->{'ModifyDate'} : '';
    $i->{'FileModifyDate'} = $info->{'FileModifyDate'} ? $info->{'FileModifyDate'} : '';
    $i->{'GPSDateStamp'} = $info->{'GPSDateStamp'} ? $info->{'GPSDateStamp'} : '';
    $i->{'GPSTimeStamp'} = $info->{'GPSTimeStamp'} ? $info->{'GPSTimeStamp'} : '';
    $i->{'Coords'} = $info->{'GPSLatitude'}
                   ? $info->{'GPSLatitude'} .','. $info->{'GPSLongitude'}
                   : '';
    push @exif, $i;
  }
  return \@exif; # ... although HTTP request wants a reference
}

sub changeFiles
{
  my ($dataref) = @_;

  my $respdata = { 'msg' => '', 'data' => [] };

  my $path = $dataref->{'path'};
  if ($path) {
    $path =~ s/\\+/\//g;
  } else {
    $respdata->{'msg'} = 'path variable not defined.';
    return $respdata;
  }
  
  # make existing file hash (filebase + highest-increment)
  # 1. collect all files
  my @existarry = [];
  if ( ! opendir D, $path) {
    $respdata->{'msg'} = 'Could not open path '. $path;
    return $respdata;
  } else {
    @existarry = grep { /^\d{8}_\d{6}_/ } readdir D;
    close D;
  }
  # 2. Loop through files to associate stub names with highest increment
  #    e.g. {'19710901_200000_DelValle'=>12,'19710901_200000_Bergstrom'=>24}
  my $existings = {};
  for (@existarry) {
    my ($p, $base, $ext) = getFileParts($_);
    my ($dt, $tm, $stub, $incr) = split('_', $base);
    my $fullbase = "${dt}_${tm}_${stub}";
    if ( ! defined $existings->{$fullbase} ) {
      my $ival = $incr ? $incr+0 : 0;
      $existings->{$fullbase} = { 'incr' => $ival, 'ext' => $ext };
    } else {
      my $prevmax = $existings->{$fullbase}->{'incr'};
      $incr = $incr ? $incr : 0; # satisfies strict in following comparison and addition
      $existings->{$fullbase}->{'incr'} = $incr+0 > $prevmax ? $incr+0 : $prevmax; # add 0 just 'cuz I prefer to store as int
    }
  }

  # collect files to work on into a hash, indexed by basename
  my $toRn = {};
  for (@{$dataref->{'media'}}) {
    if ($_->{'Name'}) {
      my ($p, $base, $ext) = getFileParts($_->{'Name'});
      if ( ! $toRn->{$base} ) { $toRn->{$base} = []; }
      $_->{'ext'} = $ext;
      push(@{$toRn->{$base}}, $_);
    }
  }
  
  # Change exiftool info and rename files (to next highest increment if file already exists)
  # and collect results to return to client
  foreach my $key (sort keys %{$toRn}) {
    
    for(my $i=0; $i <= $#{$toRn->{$key}}; ++$i) {

      # new exiftool info, if provided
      my $eto = new Image::ExifTool;
      if ($toRn->{$key}->[$i]->{'dates'}) {
        $eto->SetNewValue('DateTimeOriginal', $toRn->{$key}->[$i]->{'dates'});
        $eto->SetNewValue('CreateDate', $toRn->{$key}->[$i]->{'dates'});
        $eto->SetNewValue('ModifyDate', $toRn->{$key}->[$i]->{'dates'});
      }
      if ($toRn->{$key}->[$i]->{'Coords'}) {
        my ($lat,$lon) = split(',', $toRn->{$key}->[$i]->{'Coords'});
        my $latref = $lat > 0 ? 'N' : 'S';
        my $lonref = $lon > 0 ? 'E' : 'W';
        $eto->SetNewValue('GPSLatitude', $lat);
        $eto->SetNewValue('GPSLongitude', $lon);
        $eto->SetNewValue('GPSLatitudeRef', $latref);
        $eto->SetNewValue('GPSLongitudeRef', $lonref);
      }
      if ($toRn->{$key}->[$i]->{'GPSDateStamp'} && $toRn->{$key}->[$i]->{'GPSTimeStamp'}) {
        my $utcstamp = $toRn->{$key}->[$i]->{'GPSDateStamp'}
                     . ' '
                     . $toRn->{$key}->[$i]->{'GPSTimeStamp'}
                     . 'Z';
        $eto->SetNewValue('GPSDateStamp', $toRn->{$key}->[$i]->{'GPSDateStamp'});
        $eto->SetNewValue('GPSTimeStamp', $toRn->{$key}->[$i]->{'GPSTimeStamp'});
        if ($toRn->{$key}->[$i]->{'ext'} =~ /\.?(?:mp4|avi|mpg|m4v|mov|mpeg|flv)/) {
          $eto->SetNewValue('CreateDate', $utcstamp);
          $eto->SetNewValue('MediaCreateDate', $utcstamp);
        }
      }
      if ($toRn->{$key}->[$i]->{'Title'}) {
        $eto->SetNewValue('Title', $toRn->{$key}->[$i]->{'Title'});
      }
      
      # determine new filename to use
      my $newfile = '';
      my $ext = $toRn->{$key}->[$i]->{'ext'};
      my $ival = defined $existings->{$key}
               ? sprintf('%04d', $existings->{$key}->{'incr'} + $i + 1)
               : sprintf('%04d', $i); 
      my $newbase = "${path}/${key}_${ival}";
      $newfile = "${newbase}${ext}";
      for my $alph ('a' .. 'z') { # just in case - shouldn't happen
        last if ! -f $newfile;
        $newfile = $newbase . $alph . $ext;
      }

      # write new file
      my $oldfile = $path .'/'. $toRn->{$key}->[$i]->{'Oldname'};
      print "Writing ${oldfile} to ${newfile}..\n";
      if (move($oldfile, $newfile)) {
        $eto->WriteInfo($newfile);
        push(@{$respdata->{'data'}}, "Wrote $newfile");
      } else {
        warn "Cannot rename file to $newfile\n";
        push(@{$respdata->{'data'}}, "Problem writing $newfile");
        $respdata->{'msg'} = 'Problem writing at least one file';
      }
    }
  }
  $respdata->{'msg'} = 'Files written' unless $respdata->{'msg'};
  return $respdata;
}

__DATA__
@@ index.html.ep
<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Prep Media</title>
    <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/flatpickr/dist/flatpickr.min.css">
    <script src="https://cdn.jsdelivr.net/npm/flatpickr"></script>
    <script src="https://cdnjs.cloudflare.com/ajax/libs/moment.js/2.29.1/moment.min.js"></script>
    <script src="https://cdnjs.cloudflare.com/ajax/libs/moment-timezone/0.5.32/moment-timezone-with-data.min.js"></script>
    <script src="https://cdn.jsdelivr.net/npm/axios/dist/axios.min.js"></script>
    <link rel="stylesheet" href="app.css">
    <script id="config" type="application/json"><%== $config_json %></script>
    <script src="app.js" defer></script>
  </head>
  <body>
    <div id="container">
    <header>
      <div><b>soml-prepmedia</b></div>
    </header>
    <main>
    <form id="mainform" autocomplete="on"
          action="javascript:void(0);"
          enctype="application/json">
      <section id="exifbox">
        <h2>3. Tweak EXIF data</h2>
        <ul id="exiflist"><li>No files yet looked up.</li></ul>
      </section>
      <section id="maincanvas">
        <h2>1. Prepare files</h2>
        <fieldset><legend>Replacement values</legend>
          <table id="edits">
            <tr>
              <td><label for="imgStub">Stub name</label></td>
              <td><input id="imgStub" name="imgStub" /></td>
            </tr>
            <tr>
              <td><label for="imgTitle">Short title</label></td>
              <td><input id="imgTitle" name="imgTitle" /></td>
            </tr>
            <tr>
              <td><label for="imgDatetime">DateTime</label></td>
              <td><input class="date-field" id="imgDatetime" name="imgDatetime"
                   autocomplete="off" placeholder="Click to select or type" /></td>
            </tr>
            <tr>
              <td><label for="imgTimezone">Timezone</label></td>
              <td><input type="text" name="imgTimezone" list="imgTimezone"
                   value="<%== $timezone %>"/>
                  <datalist id="imgTimezone"></datalist></td>
            </tr>
            <tr>
              <td><label for="imgLocation">Location</label></td>
              <td><input type="text" autocomplete="off" name="imgLocation"
                   list="imgLocation" placeholder="Click to select or type"/>
                  <datalist id="imgLocation"></datalist></td>
            </tr>
          </table>
          <input id="editorDatetime" name="editorDatetime" type="hidden" value="" />
        </fieldset>
        <fieldset><legend>Files</legend>
          <input id="filepath" name="filepath" placeholder="Paste the file path here before dragging."/>
          <button id="usedefault" type="button">Use default</button>
          <div id="filepad">DROP FILES HERE FROM FINDER OR EXPLORER</div>
        </fieldset>
        <div id="controls">
          <button class="bigbutton" id="swizzle" type="button">2. Apply</button>
          <button class="bigbutton" id="submit" type="button">4. Submit</button>
        </div>
      </section>
    </form>
    </main>
    <footer>
      <div>Organizing SOML media with ease</div>
      <div>Oy!</div>
    </footer>
    </div>
    <dialog id="dataDialog">
      <pre id="dataField"></pre>
      <form method="dialog">
        <button id="dialogClose">&#x274E;</button>
        <menu>
          <button value="cancel">Cancel</button>
          <button id="confirmBtn" value="default">Confirm and write to files</button>
        </menu>
      </form>
    </dialog>
  </body>
</html>
