function getCanvasBitmapState() {
  function o(e) {
      r || (r = (new Uint32Array(e.buffer, 0, 1))[0], e = new Uint8Array(e.buffer, 4));
      for (var t = 0; t < e.byteLength; t++) i[s + 2 * t] = e[t] >> 4, i[s + 2 * t + 1] = e[t] & 15;
      s += e.byteLength * 2
  }
  var e = $.Deferred(),
      r, i = new Uint8Array(t.config.place_canvas_width * t.config.place_canvas_height),
      s = 0;
  if (window.fetch) fetch("https://oauth.reddit.com/api/place/board-bitmap", {
      credentials: "include"
  }).then(function(t) {
      function n(t) {
          t.read().then(function(s) {
              s.done ? e.resolve(r, i) : (o(s.value), n(t))
          })
      }
      if (!t.body || !t.body.getReader) {
          t.arrayBuffer().then(function(t) {
              o(new Uint8Array(t)), e.resolve(r, i)
          });
          return
      }
      n(t.body.getReader())
  });
  else {
      var u = new XMLHttpRequest;
      u.responseType = "arraybuffer";
      var a = u.open("GET", "https://oauth.reddit.com/api/place/board-bitmap", !0);
      u.onload = function(t) {
          var n = u.response;
          n || e.resolve();
          var s = new Uint8Array(n);
          o(s), e.resolve(r, i)
      }, u.send(null)
  }
  return e.promise()
}

function hexToRgb(hex) {
    var result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result ? {
        r: parseInt(result[1], 16),
        g: parseInt(result[2], 16),
        b: parseInt(result[3], 16)
    } : null;
}

function begin() {
  $('.login-link').hide();
  $('.main').fadeIn();
  let color_palette = ["#FFFFFF", "#E4E4E4", "#888888", "#222222", "#FFA7D1", "#E50000", "#E59500", "#A06A42", "#E5D900", "#94E044", "#02BE01", "#00D3DD", "#0083C7", "#0000EA", "#CF6EE4", "#820080"];
  let ctx;
  $('#uploader').change(function() {
    let fr = new FileReader();
    fr.onload = function() {
      let img = new Image();
      img.src = fr.result;
      if(img.width>1000 || img.height>1000) {
        alert('Image is too large. Maximum dimensions are 1000x1000');
      } else {
        $('#base').attr('src',fr.result);
        $('#dims')[0].innerHTML = img.width+' x '+img.height;
        let canvas = document.createElement('canvas');
        canvas.width = img.width;
        canvas.height = img.height;
        ctx = canvas.getContext('2d');
        ctx.drawImage(img,0,0,canvas.width,canvas.height);
        getCanvasBitmapState().then(function(tstamp,buffer) {
          let xstart = $('#xcoord').val();
          let x = xstart;
          let ystart = $('#ycoord').val();
          let y = ystart;
          let idata = new ImageData(img.width,img.height);
          for(let i = 0;i < idata.data.length;i+=4) {
            let color = hexToRgb(color_palette[buffer[y*1000+x]]);
            idata.data[0] = color.r;
            idata.data[1] = color.g;
            idata.data[2] = color.b;
            idata.data[3] = 255;
            
            x += 1;
            if(x>xstart+img.width) {
              x = xstart;
              y += 1;
            }
          }
          $('#map').width(img.width);
          $('#map').height(img.height);
          ctx = $('#map')[0].getContext('2d');
          ctx.putImageData(idata,0,0)
        });
      }
    }
    fr.readAsDataURL(this.files[0]);
  });
}

$('document').ready(function() {
  $('.login-link').click(function() {
    window.location.href = 'https://ssl.reddit.com/api/v1/authorize?client_id=PnOotpssqGG5Bg&response_type=code&state=blank&redirect_uri=https://SomeBall-1.github.io/placer/&duration=permanent&scope=identity';
  });
  begin();

  let client = {id: 'PnOotpssqGG5Bg', secret: 'klxKNHrPgQGuVV3ARqCj9_nLnXg'}; //not much of a secret
  function Authorize(type,val) {
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
        console.log('successful first time');
        result.timestamp = Date.now();
        $.cookie('reddit_info',JSON.stringify(result));
        begin();
    	},
    	error: function(e) {
    		console.log('Error:',e);
        alert('Error: '+e);
    	}
    });
  }
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
      Authorize('authorization_code',getQueryVariable('code'))
    }
  } else { //first time load?
    let login_items = $.cookie('reddit_info');
    if(login_items) { //not first time
      $.ajax({
        type: 'GET',
        url: 'https://oauth.reddit.com/api/v1/me',
        crossDomain: true,
        headers: {
          'Authorization': login_items.token_type + ' ' + login_items.access_token
        }
      }).fail(function() { //lost authorization
        Authorize('refresh_token',login_items.refresh_token);
      }).done(function(result) {
        if (result.error) { //lost authorization
          Authorize('refresh_token',login_items.refresh_token);
        } else {
          console.log('successful refresh');
          result.timestamp = Date.now();
          $.cookie('reddit_info',JSON.stringify(result));
          begin();
        }
      });
    }
  }
});