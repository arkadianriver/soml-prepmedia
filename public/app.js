/**
 * Got kinda long, so am using section fonts for vscode minimap:
 * http://patorjk.com/software/taag => h1 - Georgia11, h2 - banner
 * 
 * patterns and assists from:
 * - https://www.learnwithjason.dev/blog/get-form-values-as-json/
 * - https://pro.academind.com/p/javascript-the-complete-guide-2020-beginner-advanced
 * - Trusty MDN https://developer.mozilla.org
 */



/*****************************************************************
                                                            
              ,,           ,,                   ,,          
  .g8"""bgd `7MM          *MM                 `7MM          
.dP'     `M   MM           MM                   MM          
dM'       `   MM  ,pW"Wq.  MM,dMMb.   ,6"Yb.    MM  ,pP"Ybd 
MM            MM 6W'   `Wb MM    `Mb 8)   MM    MM  8I   `" 
MM.    `7MMF' MM 8M     M8 MM     M8  ,pm9MM    MM  `YMMMa. 
`Mb.     MM   MM YA.   ,A9 MM.   ,M9 8M   MM    MM  L.   I8 
  `"bmmmdPY .JMML.`Ybmd9'  P^YbmdP'  `Moo9^Yo..JMML.M9mmmP' 
                                                            
                                                            
*/

const mainForm = document.getElementById('mainform');
const swizzleBtn = document.getElementById('swizzle');
const submitBtn = document.getElementById('submit');
const dataDialog = document.getElementById('dataDialog');
const dataField = document.getElementById('dataField');
const confirmBtn = document.getElementById('confirmBtn');
const defPathBtn = document.getElementById('usedefault');
const imgDatetime = document.getElementById('imgDatetime');
const imgStub = document.getElementById('imgStub');
const imgTitle = document.getElementById('imgTitle');
const imgTimezone = document.getElementById('imgTimezone');
const editorDatetime = document.getElementById('editorDatetime');
const imgLocation = document.getElementById('imgLocation');
const fileChooser = document.getElementById('filechooser');
const exifList = document.getElementById("exiflist");
const filePad = document.getElementById("filepad");
const filePathObj = document.getElementById("filepath");
let filePath = filePathObj.value;

// triggered when EXIF DOM is fully loaded
const finishedLoading = new Event('finishedLoading');

const config = JSON.parse(document.getElementById('config').text);

// Datetime UI widget
const fp = flatpickr(imgDatetime, {
  enableTime: true,
  dateFormat: 'Y:m:d H:i:S',
  enableSeconds: true,
  time_24hr: true
});




/********************************************************************

                                                                                
                                                 ,,                             
`7MM"""YMM                                mm     db                             
  MM    `7                                MM                                    
  MM   d `7MM  `7MM  `7MMpMMMb.  ,p6"bo mmMMmm `7MM  ,pW"Wq.`7MMpMMMb.  ,pP"Ybd 
  MM""MM   MM    MM    MM    MM 6M'  OO   MM     MM 6W'   `Wb MM    MM  8I   `" 
  MM   Y   MM    MM    MM    MM 8M        MM     MM 8M     M8 MM    MM  `YMMMa. 
  MM       MM    MM    MM    MM YM.    ,  MM     MM YA.   ,A9 MM    MM  L.   I8 
.JMML.     `Mbod"YML..JMML  JMML.YMbmd'   `Mbmo.JMML.`Ybmd9'.JMML  JMML.M9mmmP' 
                                                                                
                                                                                
*/

/*

  #####                             
 #     # ###### ##### #    # #####  
 #       #        #   #    # #    # 
  #####  #####    #   #    # #    # 
       # #        #   #    # #####  
 #     # #        #   #    # #      
  #####  ######   #    ####  #      
                                    
*/

/**
 * Init the timezone field
 * - run on window load (see events)
 */
function timezoneSelect() {
  const zones = [];
  moment.tz.names().forEach(zone => {
    const offset = moment.tz(zone).format('ZZ');
    zones.push(`${offset} ${zone}`);
  });
  zones.sort().forEach(z => {
    const opt = document.createElement("option");
    const off_name = z.split(' ');
    opt.value = off_name[0];
    opt.appendChild(document.createTextNode(z));
    if (off_name[1] === config.defaultTimezone) opt.selected = true;
    imgTimezone.appendChild(opt);    
  });
}

/**
 * Init the location field
 * - run on window load (see events)
 */
function locationSelect() {
  config.knownLocations.forEach( loc => {
    const opt = document.createElement("option");
    opt.value = `${loc.lat},${loc.lon}`;
    opt.appendChild(document.createTextNode(loc.name));
    if (loc === config.defaultLocation) opt.selected = true;
    imgLocation.appendChild(opt);    
  });
}



/*

 ######                            ######  ####### #     # 
 #     # #    # # #      #####     #     # #     # ##   ## 
 #     # #    # # #      #    #    #     # #     # # # # # 
 ######  #    # # #      #    #    #     # #     # #  #  # 
 #     # #    # # #      #    #    #     # #     # #     # 
 #     # #    # # #      #    #    #     # #     # #     # 
 ######   ####  # ###### #####     ######  ####### #     # 
                                                           
*/

/**
 * Creates the EXIF list of tabular data for the files.
 * The DOM is fine as persistent storage for the data
 * (which is why we don't need to use an IndexedDB, originally attempted and removed)
 * Data is stored in input values and titles so that the title values
 * can be seen as tooltips when hovered, and reverted to if necessary during user tweaking.
 * 
 * This is async to enable await because Axios used to fetch is a promise
 * (..or something. I'm still a newb when it comes to async, promises, closures, etc.)
 * 
 * @param {Array} flist - list of files to work on, obtained from the file pad drop
 */
async function makeExifDOM(flist) {

  // clear existing list
  while (exifList.firstChild) exifList.removeChild(exifList.firstChild);
  const eli = new Image();

  // show spinner while fetching data
  eli.src = "/loading103.svg";
  exifList.appendChild(eli);

  // get the data (server action takes some time)
  const exifData = await serverGetExif(flist);

  // remove spinner
  exifList.removeChild(exifList.firstChild);

  // constructing each entry
  // need the index i to identify each entry's form data
  exifData.sort((a, b) => a.Name > b.Name ? 1 : -1).forEach( (entry, i) => {

    const listItem = document.createElement('li');
    listItem.classList.add("exif-item");

    // little button to disable
    const enableCheck = document.createElement('input');
    enableCheck.setAttribute("type", "checkbox");
    enableCheck.setAttribute("id", `item-${i}_enable`);
    enableCheck.setAttribute("name", `item-${i}_enable`);
    enableCheck.setAttribute("checked", "");
    
    // logic to choose which date radio button to select as the default
    entry['EditorDateTime'] = editorDatetime.value;
    const selectedDate = _getPriorityDate(entry);

    // thumbnail off to the left to easily identify the entry
    const thumb = document.createElement('div');
    thumb.classList.add("thumb");
    const thumbImg = new Image();
    thumbImg.src = entry['thumb'];
    thumb.appendChild(thumbImg);

    // use a table for all the field data
    const tab = document.createElement('table');
    const tbd = document.createElement("tbody");

    // using the order in my config, assign key, value (, and controls) for each row
    config.orderedFields.forEach( k => {

      const v = k === 'FileModifyDate'
              ? _getUTC(entry[k]) // strip off local time offset that is put here somehow ***
              : k === 'Path'
              ? filePath          // add in the path from the field
              : entry[k];
      
      // *** TODO:
      //   Need to figure out timezone handling logic among Windows, EXIFTool, Galaxy phone
      //   to change this to be handled appropriately.
      // TODO 2:
      //   All this node creating, appending, and setting is tiresome.
      //   (Only halfway through Max's course, maybe there's a better way)
      //   Would seem funny to add so many effiencies in ECMA-6 without touching the DOM.

      const tr = document.createElement("tr");

      // Date values are special (use radio buttons to select)
      if (k.match(/Date/)) {
        const tk = document.createElement("td");
        // key
        const tkl = document.createElement("label");
        const tkt = document.createTextNode(k);
        tkl.setAttribute("for", `item-${i}_${k}`);
        tkl.appendChild(tkt);
        tk.appendChild(tkl);
        tr.appendChild(tk);
        // value
        const tv = document.createElement("td");
        if (k.match(/Editor/)) tv.setAttribute("id",`item-${i}_eDateVal`); // for later querySelector
        const tvt = document.createTextNode(v);
        tv.appendChild(tvt);
        tr.appendChild(tv);
        // control column
        const tc = document.createElement("td");
        if (v || k.match(/Editor/)) { // user might not yet have applied a value in the global editor
          const tvi = document.createElement("input");
          tvi.setAttribute("type", "radio");
          tvi.setAttribute("id", `item-${i}_${k}`);
          tvi.setAttribute("name", `item-${i}_dates`);
          tvi.setAttribute("value", v);
          if (k === selectedDate) tvi.setAttribute("checked", ""); // select the default
          tc.appendChild(tvi);  
        } else {
          const tct = document.createTextNode('');
          tc.appendChild(tct);
        }
        tr.appendChild(tc);
      } else {  // other non-Date fields
        // key
        const tk = document.createElement("td");
        const tkt = document.createTextNode(k);
        tk.appendChild(tkt);
        tr.appendChild(tk);
        // value
        const tv = document.createElement("td");
        if (k === 'Path') { // Path doesn't need an input field for tweaking
          const tvt = document.createTextNode(v);
          tv.appendChild(tvt);
        } else {
          const tvi = document.createElement("input");
          tvi.setAttribute("id", `item-${i}_${k}`);
          tvi.setAttribute("name", `item-${i}_${k}`);
          tvi.setAttribute("title", v);
          tvi.setAttribute("value", v);
          tv.appendChild(tvi);
          if (k === 'Coords') { // add map show button to field
            tv.setAttribute("style","border:none;display:flex;flex-flow:column nowrap");
            const mapbtn = document.createElement("button");
            const mapbtnt = document.createTextNode("Show");
            mapbtn.classList.add("btnmap");
            mapbtn.appendChild(mapbtnt);
            mapbtn.setAttribute("id",`btnmap_item-${i}_${k}`);
            mapbtn.setAttribute("type", "button");
            tv.appendChild(mapbtn);
          }
        }
        tr.appendChild(tv);
        // control column
        const tc = document.createElement("td");
        const tvb1 = document.createElement("button");
        const tvb1t = document.createTextNode("Apply");
        tvb1.classList.add("btnapply");
        tvb1.setAttribute("id", `btnapply_item-${i}_${k}`);
        tvb1.setAttribute("name", `btnapply_item-${i}_${k}`);
        tvb1.setAttribute("type", "button");
        tvb1.appendChild(tvb1t);
        tc.appendChild(tvb1);
        const tvb2 = document.createElement("button");
        const tvb2t = document.createTextNode("Reset");
        tvb2.classList.add("btnreset");
        tvb2.setAttribute("id", `btnreset_item-${i}_${k}`);
        tvb2.setAttribute("name", `btnreset_item-${i}_${k}`);
        tvb2.setAttribute("type", "button");
        tvb2.appendChild(tvb2t);
        tc.appendChild(tvb2);
        tr.appendChild(tc);
      }
      tbd.appendChild(tr);
    });
    tab.appendChild(tbd);
    tab.classList.add("exif-table");
    
    // hang all newly created elements to the list item
    listItem.appendChild(enableCheck);
    listItem.appendChild(thumb);
    listItem.appendChild(tab);
    listItem.setAttribute('id', `item-${i}`);

    // and list
    exifList.appendChild(listItem);
  });

  // go initialize and provide handlers for all these new controls
  // (probably could have done it all here while building, but this is messy enough as it is)
  exifList.dispatchEvent(finishedLoading);

  console.log('All EXIF info displayed');
}


/*

 ######                                                  #    ######  ### 
 #     #   ##    ####  #    # ###### #    # #####       # #   #     #  #  
 #     #  #  #  #    # #   #  #      ##   # #    #     #   #  #     #  #  
 ######  #    # #      ####   #####  # #  # #    #    #     # ######   #  
 #     # ###### #      #  #   #      #  # # #    #    ####### #        #  
 #     # #    # #    # #   #  #      #   ## #    #    #     # #        #  
 ######  #    #  ####  #    # ###### #    # #####     #     # #       ### 
                                                                          
*/

/**
 * Fetch EXIF data about these files.
 * Returns a list of records.
 * 
 * @param {Array} flist - the list of files obtained from the file pad drop
 */
function serverGetExif(flist) {
  const data = flist.map( a => `${filePath}\\${a}`);
  return axios.post('http://localhost:8989/getexif', data)
  .then(function (response) {
    return response.data;
  })
  .catch(function (error) {
    console.log(error);
  });
}

/**
 * Simple test if file exists in the path specified so we know we're in the right
 * place when obtaining EXIF data and ultimately writing to the right files.
 * 
 * @param {String} path - path to the files on the file pad drop
 * @param {String} file - file to test (first file in flist array)
 */
function serverPathMismatch(path, file) {
  path += path.substr(-1).match(/[\\\/]/) ? '' : '\\';
  const joined = path+file;
  const data = `${joined}`;
  return axios.post('http://localhost:8989/fileexist', data, {
    headers: {
      // Plain text 'cuz one string and don't feel like escaping backslashes here
      // and dereferencing arrayrefs there.. just a hassle.
      'Content-Type': 'text/plain'
    }
  })
  .then(function (response) {
    return response.data === 1 ? false : true; // checking MISmatch, return opposite
  })
  .catch(function (error) {
    console.log(error);
  });
}


/*

 #     #                       
 #     # ##### # #       ####  
 #     #   #   # #      #      
 #     #   #   # #       ####  
 #     #   #   # #           # 
 #     #   #   # #      #    # 
  #####    #   # ######  ####  
                               
*/

// collection of "private" functions (sort of)

/**
 * Using the order of prececence in the config,
 * return which date to use as the default
 * (when making the default radio button selection in the exifList)
 * 
 * @param {Object} record - the EXIF record to check
 */
function _getPriorityDate(record) {
  for (i=0; i < config.dateOrderOfPrecedence.length; ++i) {
    const d = config.dateOrderOfPrecedence[i];
    if (record[d]) return d;
  }
  return '';
}

/**
 * Return either an image or iframe element to display as the map
 * (when a map **show** button is clicked)
 * 
 * @param {String} geo - Lat,Long string to use in the URL
 * @param {String} type - Which type of map (['image'|'iframe']) to return
 */
function _getMap(geo, type = '') {
  switch (type) {
    case 'image':
      const tvi = new Image();
      tvi.src = `https://maps.googleapis.com/maps/api/staticmap?size=300x150&zoom=12&markers=${geo}&key=${config.googleMapsAPIKey}`;
      return tvi;  
      break;
    case 'iframe':
      const tvf = document.createElement("iframe");
      tvf.setAttribute("width","300");
      tvf.setAttribute("height","150");
      tvf.setAttribute("src", `https://www.google.com/maps/embed/v1/place?q=${geo}&key=${config.googleMapsAPIKey}`);
      return tvf;  
      break;
    default:
      return document.createTextNode('');
  }
}

/**
 * Return the UTC time when given a timestamp with a timezone.
 * 
 * @param {String} localwithzone - a timestamp that contains a timezone offset
 */
function _getUTC(localwithzone) {
  if (!localwithzone || !localwithzone.match(/[\-\+]/)) return localwithzone;
  const utcmom = moment.utc(localwithzone, "YYYY:MM:DD HH:mm:SSZ");
  return utcmom.format("YYYY:MM:DD HH:mm:SS");
}

/**
 * Returns the date selected by the radio buttons for the given exifList item.
 * 
 * @param {String} id - list item identifier
 */
function _getSelectedDate(id) {
  const dateAsExif = mainForm.elements[`${id}_dates`].value;
  return dateAsExif
       ? moment(dateAsExif, "YYYY:MM:DD HH:mm:SS").format("YYYYMMDD_HHmmSS")
       : '';
}

/**
 * Determines the stub name (plus extension) to use when rewriting the file name.
 * Logic is to use the one from the global editor first and to strip off any
 * pre-existing date information (in case this file was already acted upon before).
 * Unfortunately, there are many date formats and useless number combinations to
 * strip out of filenames (facebook IDs, etc.). Maybe take that as a TODO.
 * 
 * @param {String} fieldVal - file name as specified in the input field
 */
function _getNewStubPlusExt(fieldVal) {
  const extArr = fieldVal.match(/\.[0-9a-z]+$/i);
  const extVal = extArr ? extArr[0].toLowerCase() : '';
  const givenStub = fieldVal.match(/^\d{8}_\d{6}/)
                  ? fieldVal.substring(16, fieldVal.length - extVal.length)
                  : fieldVal.substring(0, fieldVal.length - extVal.length);
  return imgStub.value ? `${imgStub.value}${extVal}` : `${givenStub}${extVal}`;
}

/**
 * Checks if the title value (original value) matches the value value to see if
 * the element has been modified. If so, sets a class that can be used to indicate
 * it as modified to the user (e.g. red background).
 * 
 * Unfortunately, I don't know of any event that fires when a value is updated
 * programatically, so this is called not only on the 'input' event when the user
 * makes a change, but also whenever the value is changed here by the app.
 * 
 * @param {DOMInputElement} inputElement - the element to act upon
 */
function _indicateIfModified(inputElement) {
  if (inputElement.title === inputElement.value) {
    inputElement.classList.remove("modified");
  } else {
    inputElement.classList.add("modified");
  }
}



/*****************************************************************
                                                    
                                                    
`7MM"""YMM                             mm           
  MM    `7                             MM           
  MM   d `7M'   `MF'.gP"Ya `7MMpMMMb.mmMMmm ,pP"Ybd 
  MMmmMM   VA   ,V ,M'   Yb  MM    MM  MM   8I   `" 
  MM   Y  , VA ,V  8M""""""  MM    MM  MM   `YMMMa. 
  MM     ,M  VVV   YM.    ,  MM    MM  MM   L.   I8 
.JMMmmmmMMM   W     `Mbmmd'.JMML  JMML.`MbmoM9mmmP' 
                                                    
                                                    
*/

// So many events to drive the UI. Some have handler functions and some use
// anonymous functions specified in the listener. They're all below ...
//
// ... even the ones for the exifList, which need to be defined after the
// exifList is loaded, which itself is triggered by a custom event.

/*

 #     #                                                  
 #     #   ##   #    # #####  #      ###### #####   ####  
 #     #  #  #  ##   # #    # #      #      #    # #      
 ####### #    # # #  # #    # #      #####  #    #  ####  
 #     # ###### #  # # #    # #      #      #####       # 
 #     # #    # #   ## #    # #      #      #   #  #    # 
 #     # #    # #    # #####  ###### ###### #    #  ####  
                                                          
*/

/**
 * Browser DataTransfer event that provides the list of files _dropped_ onto
 * the drop pad. This file list is immediately passed to makeExifDOM() to pass
 * to the server and construct the exifList.
 * 
 * Why wait since it's only constructed once per _drop session_.
 * 
 * @param {Event} event - the 'drop' event that triggered this
 */
async function fileDrop(event)
{
  const dt = event.dataTransfer;
  const flist = Array.from(dt.files).map( a => a.name );
  if (!flist[0]) return;
  if (await serverPathMismatch(filePath, flist[0])) {
    alert("The files aren't in the specified path.");
  } else {
    makeExifDOM(flist);
  }
}

/**
 * After the exifList DOM is built, assign a bunch of listeners and handlers
 * to each of the controls so they can be of use to the user while tweaking
 * stuff.
 * 
 * In the handlers, when each value is set programatically, check if modified
 * from the original, because no event (that I know of) captures that.
 * TODO: Is that for real? because it's messy and error prone.
 */
function initExifListControls() {
  // Reset buttons - for user to go back to original value
  const resetbtns = document.querySelectorAll('.btnreset');
  resetbtns.forEach( btn => {
    btn.addEventListener('click', function() {
      const field = document.getElementById(btn.id.substring(9));
      field.value = field.title;
      _indicateIfModified(field);
    });
  });
  // Apply buttons - for user to apply the global editor's value to the field.
  // The Name is special because it involves determining both the date and the stub
  // TODO - maybe make a fn(), since also done by the global **Apply** button.
  const applybtns = document.querySelectorAll('.btnapply');
  applybtns.forEach( btn => {
    btn.addEventListener('click', function() {
      const field = document.getElementById(btn.id.substring(9)); // e.g. item-3_Name
      const fieldParts = btn.id.split('_'); // e.g. btnapply_item-3_Name
      switch (fieldParts[2]) {
        case 'Name':
          const dateVal = _getSelectedDate(fieldParts[1], 'fileformat');
          if (!dateVal) {
            // TODO - find a way to alert user of stuff while within handlers,
            // which throw violations because alerts "block" and thus take too long
            alert('You need to provide a value for the date.');
            return;
          }
          field.value = `${dateVal}_${_getNewStubPlusExt(field.value)}`;
          break;
        case 'Title':
          field.value = imgTitle.value;
          break;
        case 'Coords':
          field.value = imgLocation.value;
          break;
        default:
          return;
      }
      _indicateIfModified(field);
    });
  });
  // show button for each map with a 'click' handler that shows the 'image' version of the map
  const mapbtns = document.querySelectorAll('.btnmap');
  mapbtns.forEach( btn => {
    btn.addEventListener('click', function() {
      const field = document.getElementById(btn.id.substring(7));
      const td = field.parentElement;
      const map = field.value ? _getMap(field.value,'image') : _getMap(field.value);
      if (td.childElementCount > 2) {
        td.replaceChild(map, td.lastChild);
      } else {
        td.appendChild(map);
      }
    });
  });
  // all "user-input" fields (second column) need 'input' event handlers to
  // indicate changes when user changes the input
  // (prefer 'input' to 'change' because want an indicator whether committed or not)
  const exifInputs = document.querySelectorAll('.exif-table tbody td:nth-child(2) input');
  exifInputs.forEach( i => {
    _indicateIfModified(i);
    i.addEventListener('input', function() {
      _indicateIfModified(i);
    });
  });
}

/**
 * Fired when the **Apply values** button is clicked, this fn() applies the values
 * in the global editor to all the relevant fields in the exifList.
 * 
 * Still in debate if this is how I want this workflow to go, but as the primary user,
 * I'm assuming I'll want to globally set things (like the CLI) and tweak things only
 * on occasion when I notice inconsistencies. Plus, that's why I have the
 * _change indicator_ to more easily scan what's what.
 * 
 * We'll see.. when I start using this _in production_.
 * 
 * TODO: Maybe abstract out into a fn() what's done here and what's done in the
 * individual exifList field **Apply** buttons.
 */
function applyReplacements() {
  // make sure defaults are set
  if(![imgStub, imgTitle, imgDatetime].every(f => f.value)) {
    alert("Missing value for stub, title, or date.");
    return;
  }
  // get utctime
  const utctime = imgDatetime.value
                ? _getUTC(imgDatetime.value+imgTimezone.value)
                : '';
  editorDatetime.value = utctime;
  // set appropriate values and indicate changed
  exifList.childNodes.forEach( li => {
    [ ['Title', imgTitle.value],
      ['Coords', imgLocation.value],
      ['EditorDateTime', editorDatetime.value] ].forEach ( entry => {
      const inputField = li.querySelector(`#${li.id}_${entry[0]}`);
      inputField.value = entry[1];
      if (entry[0] === 'EditorDateTime') {
        const td = li.querySelector(`#${li.id}_eDateVal`);
        td.textContent = entry[1];
      }
      // TODO-FIXME next:
      // File rename, taking into account new date, stub, and possibly do 
      // duplicate checking (among this set of files) here in the client
      // in addition to on the server. Maybe not, though, since it has to
      // be done on the server for sure, since it has access to all the
      // files in the path.
      _indicateIfModified(inputField);  
    });
  });
}

/**
 * Triggered when **Submit** button is clicked, which is a normal button, not submit.
 * (not a traditional "form" submit, since we're not wanting to refresh the page)
 * 
 * When clicked, obtain JSON from the exifList to display first and confirm before
 * sending off to the server.
 * 
 * Pattern to use Array with mainForm.elements from learnwithjason.dev. He uses [].reduce(),
 * yet I'm using [].forEach() to build mutiple records in my data structure rather than
 * a single accumulated data object. See his implementation if you need to also handle
 * multiple selects.
 * 
 * @param {Event} event - not needed since not using a "form" action to disable?
 */
function onSubmit(event) {
  const data = [];
  // Validity checks as fn()s for readability in test below
  // Without this one, too many empty fields we don't need.
  const isNotEmpty = elem => {
    return elem.name && elem.value;
  }
  // For radios (or checkboxes) only use one(s) with the 'checked' _property_ (not attribute)
  const isACheckedOne = elem => {
    return (!['checkbox','radio'].includes(elem.type) || elem.checked);
  }
  // Provided all Form elements, group according to list id in results
  Array.from(mainForm.elements).forEach( elem => {
    if (isNotEmpty(elem) && isACheckedOne(elem)) {
      const key = elem.name.match(/^item-\d+/);
      if (key) {
        const kv = elem.name.split('_');
        const i = parseInt(kv[0].substr(5), 10);
        if (!data[i]) data[i] = {};
        data[i][kv[1]] = elem.value;
      }
    }
  });

  // Display dataField JSON content in <pre> for confirmation.
  // TODO - Is this really necessary? Might slow down the workflow; we'll see.
  dataField.textContent = JSON.stringify(data.filter( e => e.enable ), null, 2);
  dataDialog.showModal();
}


/*

 #                                                         
 #       #  ####  ##### ###### #    # ###### #####   ####  
 #       # #        #   #      ##   # #      #    # #      
 #       #  ####    #   #####  # #  # #####  #    #  ####  
 #       #      #   #   #      #  # # #      #####       # 
 #       # #    #   #   #      #   ## #      #   #  #    # 
 ####### #  ####    #   ###### #    # ###### #    #  ####  
                                                           
*/

// For the **Use default** button to set the global filePath
defPathBtn.addEventListener('click', function() {
  filePathObj.value = config.defaultPath;
  filePath = filePathObj.value;
});
// Also set the filePath variable when the field is updated by the user
filePathObj.addEventListener('change', function(){
  filePath = filePathObj.value;
});

// The fun begins when files are ultimately 'dropped' on the pad
// (I don't even know the default DT actions. Got this from MDN example.)
filePad.addEventListener('dragenter', function(event) {
  event.stopPropagation();
  event.preventDefault();
});
filePad.addEventListener('dragover', function(event) {
  event.stopPropagation();
  event.preventDefault();
});
filePad.addEventListener('drop', function(event) {
  event.stopPropagation();
  event.preventDefault();
  fileDrop(event);
});

// custom event, triggered when exifList DOM is constructed
exifList.addEventListener('finishedLoading', initExifListControls);

// Apply button
swizzle.addEventListener('click', applyReplacements);

// Submit button
submitBtn.addEventListener('click', onSubmit);

// Initialize date and location fields after the app is first loaded
window.addEventListener('load', function() {
  locationSelect();
  timezoneSelect();
});

