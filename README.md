
# soml-prepmedia

Sets metadata about media (movie, pic) files, by using [Exiftool](https://exiftool.org).
(Actually, exiftool works on all kinds of files, but media is what I'm interested in.)

![web app ui](readme.png)

## Purpose

To be used for cataloging Story of My Life (soml) media.

Soml will _most likely_ be a blog of events,
where each event page will have two API calls.

1. A call to the media server to return all media where
   the date falls between the date range of the event.
1. A call to a map server to map the geographic location
   of each media file
   (and kml files in the blog, if provided, for paths, areas, and other map details).

Because I haven't yet determined exactly how soml will work,
we're capturing as much important information as possible:

- Some photo applications can index images by EXIF data,
yet for better archiving and simpler implementation,
it's nice to also be sortable and searchable by file name.
- Hopefully soml will have a way to map the data geographically.
- As for comments, the idea is for soml itself to log the event details,
but in case soml is lost, at least the names and events will be captured
in the media Title fields.

## Using this thing

I started to use a CLI, but didn't feel I had enough control, particularly in
choosing which date to use while handling a batch of files. I thus created a
web app instead.

### Web application

**Installation:**

Install
[Perl]() and
[ImageMagick]().

With CPAN, install some Perl modules, including Mojolicious and some plugins:

```
cpan
install Image::Exiftool
install MIME::Base64
install Mojolicious
install Mojolicious::Plugin::JSONConfig
install Mojolicious::Plugin::StaticCache
quit
```

**Procedure:**

1. Run `server.pl` and open `http://localhost:8989` in a browser.
   Also open a file explorer conveniently next to the app.
   Size the browser so there's plenty of room in the EXIF data area.

1. Choose a batch of files belonging to a common event and apply a set of common values
   to the files.

   1. Enter data about those files in the Replacement values section.
   1. Specify the path to those files. (Browser app can't determine the local path.)
   1. Select and drag those files from your explorer onto the file drop pad in the app.
      The perl server provides existing file info that's "relevant (to me)".
   1. Click **Apply values** to write the replacement values to each file.
      (Original values are kept in the title attributes of each field.)

1. In the EXIF data area, select the date you want to use, change, revert, reapply,
   or otherwise tweak all the data fields to how you want them.
   Get everything displayed how you want it because what is shown is what will be sent to the server.

   **NOTE:** I haven't yet decided how to store the dates.
   I plan to store them as UTC since EXIF doesn't store timezone with timestamp,
   but turns out my camera stamps things with the local timestamp.
   I'm not sure I want to rewrite every file my camera records. hmm ....

1. Click **Submit**, which writes the JSON request to be sent to the server and displays it.

1. Review the details and click **Confirm and write to files** or cancel
   (and keep tweaking or whatever).

### Old CLI

**Dependencies:**

- Perl modules: Image::ExifTool, File::DosGlob (if Windows), File::Glob

**Procedure:**

```
cli-prepmedia.pl [ -o ]( -d <dirname> | -f <filename-or-wildcard> )
```

For a file, flat directory of files, or fileset, enter the data you want to set.

- GPS latitude, longitude (entered as comma separated string, per google maps)
- Date and time the content pertains to (when the event happened)
- Comment about the image (subject matter, people involved, tags)

If these are already set (such as with modern cameras),
it skips them except for the comment, where it will ask if you want to override it.

Finally, if the file isn't already named according to the DateTimeOriginal naming convention,
it renames the file based on its own datetime, or if not present in the EXIF,
the one you specify, with indexes tacked on the end if necessary for uniqueness.

**Example:**

```
C:\MyPics>perl prepmedia.pl -f samples\IMAG01*

Will work on the following files:
samples\IMAG0101.jpg
samples\IMAG0102.jpg
Proceed? (y|n) (or 'q' to quit)
=> y
The DateTime the media was taken as YYYYMMDD_HHMMSS(+|-)ZZZZ (or 'q' to quit)
=> 20190303_170000-0700
Descriptive new stubname (or blank to keep the existing basename) (or 'q' to quit)
=> DinnerParty
Gimme the Lat, Long coordinates (or 'q' to quit)
=> 47.63238063169254, -122.34962249554108
Wanna add a comment? (y|n) (or 'q' to quit)
=> y
Comment (or 'q' to quit)
=> Uncle Joe, Sarah, Dawn, and Dave
Writing samples\IMAG0101.jpg to samples\picz\20190303_185212_DinnerParty.jpg..
Writing samples\IMAG0102.jpg to samples\picz\20190303_185248_DinnerParty.jpg..
```

## Notes

- Tested on Windows 10 only
- See TODO file and TODO comments in source
