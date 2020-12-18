# soml-prepmedia

Sets metadata about media (movie, pic) files, by using [Exiftool](https://exiftool.org).
(Actually, exiftool works on all kinds of files, but media is what I'm interested in.)

For a file, flat directory of files, or fileset, ask some questions about them
(GPS latitude, longitude (entered as comma separated string, per google maps)
the datetime the photo was taken, and comment).

If these are already set, it skips them except for the comment, where it will ask
if you want to override it.

If the file isn't already named according to the DateTimeOriginal naming convention,
it renames the file based on its own datetime, or if not present in the EXIF,
the one you specify, with indexes tacked on the end if necessary for uniqueness.

## Usage

```
prepmedia.pl { -d <dirname> | -f <filename-or-wildcard> | --help | --version }
```

## Example

```
C:\MyPics>perl prepmedia.pl -f samples\IMAG01*

Will work on the following files:
samples\IMAG0101.jpg
samples\IMAG0102.jpg
Proceed? (y|n) (or 'q' to quit)
=> y
The DateTime the media was taken as YYYYMMDD_HHMMSS-ZZZZ (or 'q' to quit)
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

J:\SavedFiles\_git\soml-prepmedia>
```

## Notes

- Tested on Windows 10 only.