# soml-prepmedia

Sets metadata about media (movie, pic) files, by using [Exiftool](https://exiftool.org).
(Actually, exiftool works on all kinds of files, but media is what I'm interested in.)

## Purpose

To be used for cataloging Story of My Life (soml) media.

Soml will _most likely_ be a blog of events,
where each event page will have two API calls.

1. A call to the media server to return all media where
   the date falls between the date range of the event.
2. A call to a map server to map the geographic location
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
in the media comments.

## Usage

```
prepmedia.pl ( -d <dirname> | -f <filename-or-wildcard> | --help | --version )
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

## Example

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

- Tested on Windows 10 only.