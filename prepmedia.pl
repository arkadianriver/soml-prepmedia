#!/usr/my/bin/perl
#
# Sets metadata about media (movie, pic) files, by using Exiftool.
# (Actually, exiftool works on all kinds of files, but media is what I'm interested in.)
#
# For a file, flat directory of files, or fileset, ask some questions about them
# (GPS latitude, longitude (entered as comma separated string, per google maps)
# the datetime the photo was taken, and comment).
#
# If these are already set, it skips them except for the comment, where it will ask
# if you want to override it.
#
# If the file isn't already named according to the DateTimeOriginal naming convention,
# it renames the file based on its own datetime, or if not present in the EXIF,
# the one you specify, with indexes tacked on the end if necessary for uniqueness.

use 5.012; # Use a version of perl from this century

use strict;
use warnings;

my $debug = 1;

use Image::ExifTool qw( :Public );
use Getopt::Std;
use File::Basename;
use File::Copy;
use DateTime;

use constant FROM_UTC => 1000;
use constant TO_UTC   => 1001;
use constant BLANK_OK => 1002;

my $iswin = ($^O eq 'MSWin32' ? 1 : 0);

use if $iswin, "File::DosGlob" => qw( :glob );
use if !$iswin, "File::Glob" => qw( :bsd_glob );

sub uiget;
sub interview;
sub processDir;
sub processFile;

# --------------
# arg processing
# --------------

# not the best CLI, but meh, it works

my $usage = "usage:\n"
          . "prepmedia.pl ( -d <dirname> | -f <filename-or-wildcard> | --help | --version )\n"
          . "No spaces in directory or filenames, please. Thanks!";
sub HELP_MESSAGE() { print $usage ."\n"; }
sub VERSION_MESSAGE() { print "Version 0.1\n"; }
$Getopt::Std::STANDARD_HELP_VERSION = 1;

# init
my %opts = ('d'=>'','f'=>'');

# get cli args
getopts('d:f:', \%opts);

# test validity of args
if ($opts{'d'} && $opts{'f'}) { print 'Specify either a directory or filename. Not both.';  exit 1; }
if (!$opts{'d'} && !$opts{'f'}) { print $usage; exit 1; }

my $extraargs = join(', ', @ARGV);
if ($extraargs) { print "What's this extra stuff? ". $extraargs ."\n"; exit 1; }

# ----
# main
# ----

# To collect one or more files..
my @files = ();

# .. depending if you specified a directory, wildcard, or file.
if ($opts{'d'}) {                     # directory
  die $! if ! -d $opts{'d'};
  opendir D, $opts{'d'} or die "Cannot open dir $!\n";
  my $relfile = '';
  while (readdir D) {
    $relfile = "$opts{'d'}/$_";
    next if /^\.\.?/ or ! -f $relfile;
    push @files, $relfile;
  }
  closedir D;
} else {
  if ($opts{'f'} =~ /[\*\?]/) {       # wildcard
    if ($iswin) {
      @files = glob $opts{'f'};
    } else {
      @files = bsd_glob $opts{'f'};
    }
  } else {
    $files[0] = $opts{'f'};           # file
  }
}

print "\nWe'll work on the following files:\n";
for (@files) { print "$_\n"; }

if ('y' ne uiget('Is that correct? (y|n)', '[yn]')) { print "Quitting.\n"; exit 0; }

# ask what to write to files, if values aren't already present
my ($localtimewzone, $stubname, $lat, $lon, $comment) = interview();

# Getting local and UTC time. (See more on why in the subroutine definition.)
my $localtime = substr($localtimewzone, 0, -5);
my $tzone     = substr($localtimewzone, -5);
my $utctime   = convertTime($localtime, TO_UTC);

# process each file (with an index $i for dupe new names in dirs and globs)
for (my $i=0; $i<@files; ++$i) {
  processFile($i, $localtime, $tzone, $utctime, $stubname, $lat, $lon, $comment);
}

# End of main

# ---------------
# sub definitions
# ---------------

sub trim
# omg, perl doesn't have this
{
  my ($s) = @_;
  $s =~ s/^\s+|\s+$//g;
  return $s;
}

sub uiget
# routine to (validate and) return user input
{
  my ($msg, $regex, $allowblank) = @_;
  my $ui = '';
  while ($ui eq '') {
    print $msg . " (or 'q' to quit)\n=> ";
    $ui = <>;
    chomp $ui;
    if ($ui eq 'q') { print "Quitting."; exit 0; }
    if ($ui || $allowblank) {
      if ($regex) { # validate if regex provided
        last if $ui =~ /$regex/;
        print "(!) Response isn't valid. Match this format:\n$regex\n";
        $ui = '';
      }
      last if $allowblank;
    } else {
         print "(!) Respond with a value, or 'q' to quit.\n";
    }
  }
  return $ui;
}

sub interview
# the questions (TODO maybe add as optional command line arguments)
{
  my $loct = uiget('The DateTime the media was taken as YYYYMMDD_HHMMSS(+|-)ZZZZ', '^\d{8}_\d{6}[\+\-]\d{4}$');
  my $stub = uiget('Descriptive new stubname (or blank to keep the existing basename)', '', BLANK_OK);
  my ($lt, $ln) = split(', ', uiget('Gimme the Lat, Long coordinates', '^\-?\d+?\.\d+?, \-?\d+?\.\d+$'));
  my $confirm = uiget('Wanna add a comment? (y|n)', '[yn]');
  my $com = ($confirm eq 'y' ? uiget('Comment') : '');
  return ($loct, $stub, trim($lt), trim($ln), $com);
}

sub convertTime
# So the times.. I want files named with localtime. Internally, exiftool stores times as UTC,
# which is why in the interview we asked for the localtime and timezone in which the file was taken.
# If the file doesn't already have date taken, we'll convert the interview-provided datetime to UTC.
# If the file does have date taken, we'll convert that to our local timezone for the new filename.
{
  my ($time, $zone, $direction) = @_;
  my $fromzone = '';
  my $tozone = '';

  # set timezone vars based on whether to convert to or from UTC
  if ($direction && $direction == FROM_UTC) {
    $fromzone = 'UTC';
    $tozone = $zone;
  } else {
    $fromzone = $zone;
    $tozone = 'UTC';
  }

  # init datetime object with provided datetime and what zone to convert from
  my @t = ($time =~ /(\d{4})(\d\d)(\d\d)_(\d\d)(\d\d)(\d\d)/);
  my $dt = DateTime->new(
    year       => $t[0],
    month      => $t[1],
    day        => $t[2],
    hour       => $t[3],
    minute     => $t[4],
    second     => $t[5],
    time_zone  => $fromzone
  );

  # and convert it to the new zone (in the format we need)
  print "The original time: $dt\n" if $debug;
  $dt->set_time_zone($tozone);
  print "Converted time: $dt\n" if $debug;
  my $converted = $dt->ymd('') .'_'. $dt->hms('');

  return $converted;
}

sub processFile
# All the Exiftool fun is done here in the main processing:
# read existing info, apply interview answers if not yet in file,
# possibly override the comment, and rewrite the file by date as appropriate.
{
  my ($i, $localtime, $tzone, $utctime, $stubname, $lat, $lon, $comment) = @_;
  my $oldfile = $files[$i];

  # read existing info
  my $eto = new Image::ExifTool;
  $eto->Options(DateFormat => '%Y%m%d_%H%M%S');
  my $oldinfo = $eto->ImageInfo($oldfile);

  if ($debug) {
    print "datetimeoriginal: $oldinfo->{'DateTimeOriginal'}\n" if $oldinfo->{'DateTimeOriginal'};
    print "lat: $oldinfo->{'GPSLatitude'}\n" if $oldinfo->{'GPSLatitude'};
    print "lon: $oldinfo->{'GPSLongitude'}\n" if $oldinfo->{'GPSLongitude'};
    print "comment: $oldinfo->{'Comment'}\n" if $oldinfo->{'Comment'};
    print "usercomment: $oldinfo->{'UserComment'}\n" if $oldinfo->{'UserComment'};
  }
  
  #
  # 1. If file already has gpslatitude, gpslongitude, skip.
  #

  if ($oldinfo->{'GPSLatitude'} && $oldinfo->{'GPSLongitude'}) { $lat = ''; $lon = ''; }

  #
  # 2. If file already has comment, print and ask if you wanna change.
  #

  if ( $comment && ($oldinfo->{'UserComment'} || $oldinfo->{'Comment'}) ) {
    if ($oldinfo->{'UserComment'}) {
      print 'File '. $oldfile ." has user comment:\n  ". $oldinfo->{'UserComment'} ."\n";
    }
    if ($oldinfo->{'Comment'}) {
      print 'File '. $oldfile ." has EXIF comment:\n  ". $oldinfo->{'Comment'} ."\n";
    }
    my $confirmcomment = uiget("Do you want to change both of these to what you specified earlier?\n  "
                               . $comment
                               . "\n(y|n)");
    $comment = ($confirmcomment eq 'y' ? $comment : '');
  }
  
  #
  # 3. If file already has datetime, use that. If not, set it with provided utctime and get new localtime.
  # 

  if ($oldinfo->{'DateTimeOriginal'}) {
    $utctime = $oldinfo->{'DateTimeOriginal'};
    $localtime = convertTime($utctime, $tzone, FROM_UTC);
  } else {
    $eto->SetNewValue(DateTimeOriginal => $utctime);
    $eto->SetNewValue(CreateDate => $utctime);
  }

  #
  # 4. Set everything else
  #

  if ($lat) {
    $eto->SetNewValue(GPSLatitude => $lat);
    my $y_hemis = ( substr($lat, 0, 1) ne '-' ? 'N' : 'S' );
    $eto->SetNewValue(GPSLatitudeRef => $y_hemis);
  }
  if ($lon) {
    $eto->SetNewValue(GPSLongitude => $lon) if $lon;
    my $x_hemis = ( substr($lon, 0, 1) ne '-' ? 'E' : 'W' );
    $eto->SetNewValue(GPSLongitudeRef => $x_hemis);
  }
  if ($comment) {
    $eto->SetNewValue(Comment => $comment);
    $eto->SetNewValue(UserComment => $comment);
  }

  #
  # 5. Rename new file
  #
  
  # split name into parts
  my ($base, $path) = fileparse($oldfile);
  my $ext = '';
  if ($base =~ /^(.*)\.(.*)$/) { $base = $1; $ext = '.'. $2; }

  # keep basename if stub not provided in interview
  # (without the date part if it has it)
  $base = /^\d{8}_\d{6}[\-_]//;
  $stubname = $base unless $stubname;

  # piece back together with increment if already named
  my $allbutext = $path . $localtime .'_'. $stubname;
  $allbutext .= (-f $allbutext . $ext ? '_'. sprintf('%03d', $i) : ''); 
  my $newfile = $allbutext . $ext;

  # further alpha increment the numeric increment if it exists
  # Should only be needed when testing.
  for my $alph ('a' .. 'z') {
    last if ! -f $newfile;
    $newfile = $allbutext . $alph . $ext;
  }

  #
  # 6. Finally, write the new file
  #
  
  print "Writing ${oldfile} to ${newfile}..\n";
  if (move($oldfile, $newfile)) {
    $eto->WriteInfo($newfile);
  } else {
    warn "Cannot rename file to $newfile\n";
  }
  
}

