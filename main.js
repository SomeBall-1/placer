let active = false,
  reset = false,
  updating = false,
  width,
  height,
  drawn = 0,
  baseMap = [[]],
  recordedMap = [[]],
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

function updateMap() {
  updating = true;
  let xstart = parseInt($('#xcoord').val()),
    x = xstart,
    ystart = parseInt($('#ycoord').val()),
    y = ystart;

  $('#map')[0].width = width*2;
  $('#map')[0].height = height*2;
  function start() {
    if(reset) {
      reset = false;
      updating = false;
      return;
    }
    function jsonResponse(json) {
      if(reset) {
        reset = false;
        updating = false;
        return;
      }
      let color = json.color?rgbcolors[json.color]:rgbcolors[0]; //some pixels return an error, default to white
      let idata = new ImageData(2,2);
      idata.data[0] = idata.data[4] = idata.data[8] = idata.data[12] = color.r;
      idata.data[1] = idata.data[5] = idata.data[9] = idata.data[13] = color.g;
      idata.data[2] = idata.data[6] = idata.data[10] = idata.data[14] = color.b;
      idata.data[3] = idata.data[7] = idata.data[11] = idata.data[15] = 255;
      $('#map')[0].getContext('2d').putImageData(idata,(x-xstart)*2,(y-ystart)*2);
      if(!recordedMap[x-xstart]) recordedMap[x-xstart] = [];
      recordedMap[x-xstart][y-ystart] = json.color?json.color:0;

      x += 1;
      if(x>xstart+width) {
        x = xstart;
        y += 1;
      }
  
      if(y<=ystart+height) {
        start();
      } else {
        updating = false;
        if(active) updateMap();
      }
    }
    $.getJSON('https://www.reddit.com/api/place/pixel.json',{x,y},jsonResponse,function(e) {
      jsonResponse({}); //ignore error and default to white
    });
  }
  start();
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
      active = setTimeout(drawTile, result.wait_seconds*1000);
      if(!updating) updateMap();
    }
  });
}


function drawTile() {
  let x, y, color;
  for(let i = 0;i < baseMap.length;i++) {
    for(let j = 0;j < baseMap[0].length;j++) {
      if(!skipTile[i][j] && baseMap[i][j] && recordedMap[i] && baseMap[i][j]!=recordedMap[i][j]) {
        x = i;
        y = j;
        color = baseMap[i][j];
        break;
      }
    }
    if(x) break;
  }
  if(x) {
    function postTile() {
      login_items = JSON.parse($.cookie('reddit_info'));
      $.ajax({
        type: 'POST',
        url: 'https://oauth.reddit.com/api/place/draw.json',
        crossDomain: true,
        headers: {
          'Authorization': login_items.token_type + ' ' + login_items.access_token
        },
        data: {x, y, color},
        success: function(result) {
          if(result.error) Authorize('refresh_token',login_items.refresh_token).then(drawTile);
          else {
            $('#placed').html(++drawn);
            recordedMap[x][y] = color;
            skipTile = [[]];
            getAndSetWaitTime();
          }
        },
        error: function(e) {
          Authorize('refresh_token',login_items.refresh_token).then(drawTile);
        }
      });
    }
    $.getJSON('https://www.reddit.com/api/place/pixel.json',{x,y},function(json) {
      if(json.color && json.color===recordedMap[x][y]) {//still bad
        postTile();
      }
    },function(e) {
      if(!skipTile[x]) skipTile[x] = [];
      skipTile [x][y] = true;
    });
  } else { //nothing to change, wait a bit
    console.log('nothing to draw, trying again in 60 sec');
    active = setTimeout(drawTile, 60000);
    if(!updating) updateMap();
  }
}

function begin() {
  $('.login-link').hide();
  $('.main').fadeIn();
  let ctx;
  $('#uploader').change(function() {
    let fr = new FileReader();
    fr.onload = function() {
      let img = new Image();
      img.src = fr.result;
      if(img.width>1000 || img.height>1000) {
        alert('Image is too large. Maximum dimensions are 1000x1000');
      } else {
        width = img.width;
        height = img.height;
        $('#base').attr('src',fr.result);
        $('#dims').html(img.width+' x '+img.height);
        generateBaseMap();
      }
    }
    fr.readAsDataURL(this.files[0]);
  });
}

$('document').ready(function() {
  $('.login-link').click(function() {
    window.location.href = 'https://ssl.reddit.com/api/v1/authorize?client_id=PnOotpssqGG5Bg&response_type=code&state=blank&redirect_uri=https://SomeBall-1.github.io/placer/&duration=permanent&scope=identity';
  });
  $('#reload').click(function() {
    if($('#base').attr('src')) {
      $(this).html('Reset Map');
      updateMap();
    } else {
      alert('Upload an image first to define the size.');
    }
  });
  $('#activate').click(function() {
    if($('#reload').html()=='Load Map') {
      alert('Upload an image first and load the map before drawing.');
    } else {
      if(!active) {
        getAndSetWaitTime();
      } else {
        clearTimeout(active);
        active = false;
        reset = true;
        $('#map')[0].getContext('2d').clearRect(0,0,$('#map').width(),$('#map').height());
      }
      $(this).html(active?'Stop Placing':'Start Placing');
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