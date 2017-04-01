let active = false,
  waiting = false,
  xstart,
  ystart,
  width,
  height,
  drawn = 0,
  baseMap = [[]],
  recordedMap = [[]],
  bitmapMap = [[]],
  skipTile = [[]],
  hexcolors = ["#ffffff", "#e4e4e4", "#888888", "#222222", "#ffa7d1", "#e50000", "#e59500", "#a06a42", "#e5d900", "#94e044", "#02be01", "#00d3dd", "#0083c7", "#0000ea", "#cf6ee4", "#820080"],
  rgbcolors = [{"r":255,"g":255,"b":255},{"r":228,"g":228,"b":228},{"r":136,"g":136,"b":136},{"r":34,"g":34,"b":34},{"r":255,"g":167,"b":209},{"r":229,"g":0,"b":0},{"r":229,"g":149,"b":0},{"r":160,"g":106,"b":66},{"r":229,"g":217,"b":0},{"r":148,"g":224,"b":68},{"r":2,"g":190,"b":1},{"r":0,"g":211,"b":221},{"r":0,"g":131,"b":199},{"r":0,"g":0,"b":234},{"r":207,"g":110,"b":228},{"r":130,"g":0,"b":128}],
  client = {id: 'PnOotpssqGG5Bg', secret: 'klxKNHrPgQGuVV3ARqCj9_nLnXg'}; //not much of a secret

function Authorize(type,val) {
  return new Promise(function(resolve,reject) {
    console.log('in here',type,val)
    let data = {
    		client_id: client.id,
    		redirect_uri: 'https://SomeBall-1.github.io/placer/',
    		grant_type: type,
        scope: 'identity',
    		state: 'none'
    	};
    if(type==='authorization_code') {
      data.code = val;
    } else if(type==='refresh_token') {
      data.refresh_token = val;
    }
    $.ajax({
    	type: "POST",
    	url: 'https://ssl.reddit.com/api/v1/access_token',
    	data: data,
    	crossDomain: true,
    	headers: {'Authorization': 'Basic ' + btoa(client.id + ":" + client.secret)},
    	success: function(result) {
        if(result.error) Authorize(type,val);
        else {
          console.log('successful authorization/refresh');
          result.timestamp = Date.now();
          $.cookie('reddit_info',JSON.stringify(result));
          resolve(true);
        }
    	},
    	error: function(e) {
    		console.log('Error:',e);
        alert('Error: '+e);
        reject(false);
    	}
    });
  });
}

function generateBaseMap() {
  let canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  let ctx = canvas.getContext('2d');
  ctx.drawImage($('#base')[0],0,0,width,height);
  let idata = ctx.getImageData(0,0,width,height);

  function componentToHex(c) { //from http://stackoverflow.com/a/5624139/7206601
    var hex = c.toString(16);
    return hex.length == 1 ? "0" + hex : hex;
  }

  function rgbToHex(r, g, b) {
    return "#" + componentToHex(r) + componentToHex(g) + componentToHex(b);
  }
  for(let i = 0;i < idata.data.length;i+=4) {
    let index = hexcolors.indexOf(rgbToHex(idata.data[i],idata.data[i+1],idata.data[i+2]));
    let y = parseInt(i/idata.width/4);
    let x = i/4-y*idata.width;
    if(!baseMap[x]) baseMap[x] = [];
    if(index<0) {
      baseMap[x][y] = false;
    }
    else {
      baseMap[x][y] = index;
    }
  }
}

function drawPixel(color,x,y) {
  let idata = new ImageData(2,2);
  idata.data[0] = idata.data[4] = idata.data[8] = idata.data[12] = color.r;
  idata.data[1] = idata.data[5] = idata.data[9] = idata.data[13] = color.g;
  idata.data[2] = idata.data[6] = idata.data[10] = idata.data[14] = color.b;
  idata.data[3] = idata.data[7] = idata.data[11] = idata.data[15] = 255;
  $('#map')[0].getContext('2d').putImageData(idata,x,y);
}

function getAndSetWaitTime() {
  login_items = JSON.parse($.cookie('reddit_info'));
  $.ajax({
    type: 'GET',
    dataType: 'json',
    url: 'https://oauth.reddit.com/api/place/time.json',
    crossDomain: true,
    headers: {
      'Authorization': login_items.token_type + ' ' + login_items.access_token
    }
  }).fail(function() { //lost authorization or too fast
    Authorize('refresh_token',login_items.refresh_token).then(getAndSetWaitTime);
  }).done(function(result) {
    if (result.error) { //lost authorization or too fast
      Authorize('refresh_token',login_items.refresh_token).then(getAndSetWaitTime);
    } else {
      console.log('waiting:',result.wait_seconds);
      $('#map').trigger('wait-time',new Date(Date.now()+result.wait_seconds*1000));
      active = setTimeout(function() {
        active = false;
        drawTile()
      }, result.wait_seconds*1000+2000); //extra 2 seconds for fun
    }
  });
}

function drawTile() {
  waiting = false;
  let x, y, color;
  for(let i = 0;i < baseMap.length;i++) {
    for(let j = 0;j < baseMap[0].length;j++) {
      if((!skipTile[i] || !skipTile[i][j]) && baseMap[i][j] && recordedMap[i] && recordedMap[i][j] && baseMap[i][j]!==recordedMap[i][j]) {
        x = i;
        y = j;
        color = baseMap[i][j];
        break;
      }
    }
    if(x) break;
  }
  if(x) {
    console.log('placing at:',x+xstart,y+ystart);
    function postTile() {
      login_items = JSON.parse($.cookie('reddit_info'));
      $.ajax({
        type: 'POST',
        url: 'https://oauth.reddit.com/api/place/draw.json',
        crossDomain: true,
        headers: {
          'Authorization': login_items.token_type + ' ' + login_items.access_token
        },
        data: {x: x+xstart, y: y+ystart, color: color},
        success: function(result) {
          if(result.error) Authorize('refresh_token',login_items.refresh_token).then(drawTile);
          else {
            console.log('placed',color,'at:',x+xstart,y+ystart);
            $('#placed').html(++drawn);
            recordedMap[x][y] = color;
            drawPixel(rgbcolors[recordedMap[x][y]],(x-xstart)*2,(y-ystart)*2);
            skipTile = [[]];
            getAndSetWaitTime();
          }
        },
        error: function(e) {
          Authorize('refresh_token',login_items.refresh_token).then(drawTile);
        }
      });
    }
    $.getJSON('https://www.reddit.com/api/place/pixel.json',{x: x+xstart,y: y+ystart},function(json) { //confirm it's still bad
      if(json.color && json.color!==baseMap[x][y]) {//still bad
        postTile();
      } else {
        console.log('tile no longer bad:',x,y);
        console.log('was:',recordedMap[x][y],'should be:',baseMap[x][y],'now:',json.color||0);
        recordedMap[x][y] = json.color || 0;
        drawPixel(rgbcolors[recordedMap[x][y]],(x-xstart)*2,(y-ystart)*2);
        drawTile(); //find another tile instead
      }
    },function(e) {
      console.log('error getting tile color:',x,y);
      if(!skipTile[x]) skipTile[x] = [];
      skipTile[x][y] = true;
    });
  } else { //nothing to change, wait a bit
    console.log('nothing to draw, trying again on map refresh');
    waiting = true;
  }
}

function begin() {
  $('.login-link').hide();
  $('.main').fadeIn();
  $('#activate').click(function() {
    if($('#reload').html()==='Load Map') {
      alert('Upload an image first and load the map before drawing.');
    } else {
      if(!active) {
        xstart = parseInt($('#xcoord').val());
        ystart = parseInt($('#ycoord').val());
        width = $('#base').width();
        height = $('#base').height();
        generateBaseMap();
        getAndSetWaitTime();
        $(this).html('Stop Placing');
      } else {
        clearTimeout(active);
        active = false;
        waiting = false;
        $('#map')[0].getContext('2d').clearRect(0,0,width*2,height*2);
        $(this).html('Start Placing');
      }
    }
  });
  $('#uploader').change(function() {
    let fr = new FileReader();
    fr.onload = function() {
      let img = new Image();
      img.src = fr.result;
      if(img.width>1000 || img.height>1000) {
        alert('Image is too large. Maximum dimensions are 1000x1000');
      } else {
        $('#base').attr('src',fr.result);
        $('#dims').html(img.width+' x '+img.height);
      }
    }
    fr.readAsDataURL(this.files[0]);
  });
}

$('document').ready(function() {
  $('.login-link').click(function() {
    window.location.href = 'https://ssl.reddit.com/api/v1/authorize?client_id=PnOotpssqGG5Bg&response_type=code&state=blank&redirect_uri=https://SomeBall-1.github.io/placer/&duration=permanent&scope=identity';
  });
  $('#map').on('map-update',function(event,buffer) {
    let shouldShow = $('#base').attr('src') && (active || waiting);
    let r,
      s = 0,
      i = new Uint8Array(1000*1000);
    function o(e) {
      r || (r = (new Uint32Array(e.buffer, 0, 1))[0], e = new Uint8Array(e.buffer, 4));
      for (var t = 0; t < e.byteLength; t++) i[s + 2 * t] = e[t] >> 4, i[s + 2 * t + 1] = e[t] & 15;
      s += e.byteLength * 2
    }
    o(new Uint8Array(buffer));
    
    let ind = 0, idata;
    if(shouldShow) idata = new ImageData(width*2,height*2);
    for(let j = ystart;j < height+ystart;j++) {
      for(let k = xstart;k < width+xstart;k++) {
        let c = i[k+j*1000];
        let color = rgbcolors[c];
        if(!recordedMap[k-xstart]) recordedMap[k-xstart] = [];
        recordedMap[k-xstart][j-ystart] = c;
        if(shouldShow) {
          idata.data[ind] = idata.data[ind+4] = idata.data[ind+width*8] = idata.data[ind+4+width*8] = color.r;
          idata.data[ind+1] = idata.data[ind+5] = idata.data[ind+1+width*8] = idata.data[ind+5+width*8] = color.g;
          idata.data[ind+2] = idata.data[ind+6] = idata.data[ind+2+width*8] = idata.data[ind+6+width*8] = color.b;
          idata.data[ind+3] = idata.data[ind+7] = idata.data[ind+3+width*8] = idata.data[ind+7+width*8] = 255;
          ind += 8;
        }
      }
      if(shouldShow) ind += width*8;
    }
    if(shouldShow) {
      $('#map')[0].width = width*2;
      $('#map')[0].height = height*2;
      $('#map')[0].getContext('2d').putImageData(idata,0,0);
      if(waiting) {
        drawTile();
      }
    }
  });
  //begin();
  
  let queries = window.location.search.substring(1);
  if(queries) { //api response
    function getQueryVariable(variable) { //from https://css-tricks.com/snippets/javascript/get-url-variables/
      let vars = queries.split("&");
      for (var i=0;i<vars.length;i++) {
        let pair = vars[i].split("=");
        if(pair[0] == variable) return pair[1];
      }
      return false;
    }
    if(getQueryVariable('error')) { //denied access
      alert('Reddit access is required!');
    } else {
      Authorize('authorization_code',getQueryVariable('code')).then(function() { //dump the querystring
        window.location.href = window.location.protocol+'//'+window.location.host+window.location.pathname
      });
    }
  } else { //first time load?
    let login_items = $.cookie('reddit_info');
    if(login_items) { //not first time
      login_items = JSON.parse(login_items);
      $.ajax({
        type: 'GET',
        url: 'https://oauth.reddit.com/api/v1/me',
        crossDomain: true,
        headers: {
          'Authorization': login_items.token_type + ' ' + login_items.access_token
        }
      }).fail(function() { //lost authorization
        Authorize('refresh_token',login_items.refresh_token).then(begin);
      }).done(function(result) {
        if (result.error) { //lost authorization
          Authorize('refresh_token',login_items.refresh_token).then(begin);
        } else {
          console.log('still active, no refresh needed');
          begin();
        }
      });
    }
  }
});