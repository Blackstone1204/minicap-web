var WebSocketServer = require('ws').Server
  , http = require('http')
  , express = require('express')
  , path = require('path')
  , net = require('net')
  , app = express()



 var web_port;
 var servie_port;

process.argv.forEach(function (val, index, array) {
  if(array.length==4){

      web_port=array[2];
      service_port=array[3];
  }

  //console.log("命令参数信息");
  //console.log(index + ': ' + val);
});


if(web_port==undefined||service_port==undefined){
  console.log("参数不对");
  return;
}

var PORT = Number(web_port);
//var PORT = web_port;

//var PORT = 9002;
var PORT_2=Number(service_port);
//var PORT_2=1718;

console.log("PORT="+PORT+"|"+typeof PORT);
console.log("PORT_2="+PORT_2+"|"+typeof PORT_2);
//console.log("web访问端口="+PORT+" 服务启动端口="+PORT_2);

app.use(express.static(path.join(__dirname, '/public')))

//加入支持跨域
app.use(function(request, response) {

  response.setHeader("Access-Control-Allow-Origin","*");
  response.writeHead(200, { "Content-Type": "text/plain" });

  response.end("Hello world!\n");
});

app.get("/");

var server = http.createServer(app)
var wss = new WebSocketServer({ server: server })

wss.on('connection', function(ws) {
  console.info('Got a client')

  var stream = net.connect({
    port: PORT_2
  })

 // console.log(stream);

  stream.on('error', function() {
    console.error('Be sure to run `adb forward tcp:'+PORT_2+' localabstract:minicap`')
    process.exit(1)
  })

  var readBannerBytes = 0
  var bannerLength = 2
  var readFrameBytes = 0
  var frameBodyLength = 0
  var frameBody = Buffer.alloc(0)
  var banner = {
    version: 0
  , length: 0
  , pid: 0
  , realWidth: 0
  , realHeight: 0
  , virtualWidth: 0
  , virtualHeight: 0
  , orientation: 0
  , quirks: 0
  }

  function tryRead() {
    for (var chunk; (chunk = stream.read());) {
      //console.info('chunk(length=%d)', chunk.length)
      for (var cursor = 0, len = chunk.length; cursor < len;) {
        if (readBannerBytes < bannerLength) {
          switch (readBannerBytes) {
          case 0:
            // version
            banner.version = chunk[cursor]
            break
          case 1:
            // length
            banner.length = bannerLength = chunk[cursor]
            break
          case 2:
          case 3:
          case 4:
          case 5:
            // pid
            banner.pid +=
              (chunk[cursor] << ((readBannerBytes - 2) * 8)) >>> 0
            break
          case 6:
          case 7:
          case 8:
          case 9:
            // real width
            banner.realWidth +=
              (chunk[cursor] << ((readBannerBytes - 6) * 8)) >>> 0
            break
          case 10:
          case 11:
          case 12:
          case 13:
            // real height
            banner.realHeight +=
              (chunk[cursor] << ((readBannerBytes - 10) * 8)) >>> 0
            break
          case 14:
          case 15:
          case 16:
          case 17:
            // virtual width
            banner.virtualWidth +=
              (chunk[cursor] << ((readBannerBytes - 14) * 8)) >>> 0
            break
          case 18:
          case 19:
          case 20:
          case 21:
            // virtual height
            banner.virtualHeight +=
              (chunk[cursor] << ((readBannerBytes - 18) * 8)) >>> 0
            break
          case 22:
            // orientation
            banner.orientation += chunk[cursor] * 90
			//my add 
			if(banner.orientation==0)console.log("当前方向 竖屏");
      else console.log("当前方向 横屏");
            break
          case 23:
            // quirks
            banner.quirks = chunk[cursor]
            break
          }

          cursor += 1
          readBannerBytes += 1

          if (readBannerBytes === bannerLength) {
            //console.log('banner', banner)
          }
        }
        else if (readFrameBytes < 4) {
          frameBodyLength += (chunk[cursor] << (readFrameBytes * 8)) >>> 0
          cursor += 1
          readFrameBytes += 1
          //console.info('headerbyte%d(val=%d)', readFrameBytes, frameBodyLength)
        }
        else {
          if (len - cursor >= frameBodyLength) {
           // console.info('bodyfin(len=%d,cursor=%d)', frameBodyLength, cursor)

            frameBody = Buffer.concat([
              frameBody
            , chunk.slice(cursor, cursor + frameBodyLength)
            ])

            // Sanity check for JPG header, only here for debugging purposes.
            if (frameBody[0] !== 0xFF || frameBody[1] !== 0xD8) {
              console.error(
                'Frame body does not start with JPG header', frameBody)
              process.exit(1)
            }

            ws.send(frameBody, {
              binary: true
            })

            cursor += frameBodyLength
            frameBodyLength = readFrameBytes = 0
            frameBody = Buffer.alloc(0)
          }
          else {
            // console.info('body(len=%d)', len - cursor)

            frameBody = Buffer.concat([
              frameBody
            , chunk.slice(cursor, len)
            ])

            frameBodyLength -= len - cursor
            readFrameBytes += len - cursor
            cursor = len
          }
        }
      }
    }
  }

  stream.on('readable', tryRead)

  ws.on('close', function() {
    console.info('Lost a client')
    stream.end()
  })
})

server.listen(PORT)
console.info('web_port %d,service_port %s', PORT,PORT_2);
