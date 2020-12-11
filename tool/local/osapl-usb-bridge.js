/*
osap-usb-bridge.js

osap bridge to firmwarelandia

Jake Read at the Center for Bits and Atoms
(c) Massachusetts Institute of Technology 2020

This work may be reproduced, modified, distributed, performed, and
displayed for any purpose, but must acknowledge the open systems assembly protocol (OSAP) project.
Copyright is retained and must be preserved. The work is provided as is;
no warranty is provided, and users accept all liability.
*/

// big s/o to https://github.com/standard-things/esm for allowing this
import OSAP from '../core/osap.js'
import WSSPipe from './common/wssPipe.js'

import child_process from 'child_process'

import SerialPort from 'serialport'
import Delimiter from '@serialport/parser-delimiter'
import ByteLength from '@serialport/parser-byte-length'

import COBS from './common/cobs.js'

import { PerformanceObserver, performance } from 'perf_hooks'

import { TS, EP, PK } from '../core/ts.js'

let LOGPHY = false

// we include an osap object - a node
let osap = new OSAP()
osap.name = "local-usb-bridge"
osap.description = "node featuring wss to client and usbserial cobs connection to hardware"

// -------------------------------------------------------- WSS VPort

// and we want to have two ports,
// one a websocket server, this part of our bootstrap situation...
let wssVPort = osap.vPort() // yeah, go this
wssVPort.name = "websocket server"
// 'common node highwatermark'
// https://nodejs.org/es/docs/guides/backpressuring-in-streams/
wssVPort.phy.maxSegLength = 16384

// TODO: maybe don't need WSSPipe as a module? 
// virtual routing, etc, is part of the core/osap include,
// but we need to set it up with handles to this particular websocket server.
WSSPipe.start().then((ws) => {
	wssVPort.setPortOpen()
	wssVPort.phy.send = (buffer) => {
		if (LOGPHY) console.log('PHY WSS Send')
		if (LOGPHY) TS.logPacket(buffer)
		ws.send(buffer)
	}
	wssVPort.phy.close = () => {
		return new Promise((resolve, reject) => {
			ws.terminate()
			resolve()
		})
	}
	ws.onmessage = (msg) => {
		if (LOGPHY) console.log('PHY WSS Recv')
		if (LOGPHY) TS.logPacket(msg.data)
		wssVPort.phy.receive(msg.data)
	}
	ws.onerror = (err) => {
		wssVPort.phy.status = EP.PORTSTATUS.CLOSED
		console.log('wss error', err)
	}
	ws.onclose = (evt) => {
		wssVPort.phy.status = EP.PORTSTATUS.CLOSED
		// because this local script is remote-kicked,
		// we shutdown when the connection is gone
		console.log('wss closes, exiting')
		process.exit()
		// were this a standalone network node, this would not be true
	}
})

// -------------------------------------------------------- USB Serial VPort


let serVPort = osap.vPort()
serVPort.name = "cobs usb serial"
serVPort.phy.maxSegLength = 1024 // lettuce do this for embedded expectations}

let LOGSER = false
let LOGSERPHY = false

let findSerialPort = (pid) => {
	if (LOGSER) console.log(`SERPORT hunt for productId: ${pid}`)
	return new Promise((resolve, reject) => {
		SerialPort.list().then((ports) => {
			let found = false
			for (let port of ports) {
				console.log(`found ${port.productId}...`)
				if (port.productId === pid) {
					found = true
					resolve(port.path)
					break
				}
			}
			if (!found) reject(`serialport w/ productId: ${pid} not found`)
		}).catch((err) => {
			reject(err)
		})
	})
}

let opencount = 0 
let LOGSEARCH = false

// options: passthrough for node-serialport API
let startSerialPort = (pid, options) => {
	serVPort.phy.status = EP.PORTSTATUS.OPENING
	if(LOGSEARCH) console.log(`SERPORT Looking for Serial Port w/ PID ${pid}...`)
	findSerialPort(pid).then((com) => {
		if (LOGSEARCH) console.log(`SERPORT contact at ${com}, opening`)
		let port = new SerialPort(com, options)
		let pcount = opencount
		opencount ++
		port.on('open', () => {
			console.log(`SERPORT at ${com} #${pcount} OPEN`)
			// is now open, 
			serVPort.setPortOpen()
			// to get, use delimiter
			let parser = port.pipe(new Delimiter({ delimiter: [0] }))
			//let parser = port.pipe(new ByteLength({ length: 1 }))
			parser.on('data', (buf) => {
				let decoded = COBS.decode(buf)
				//if(decoded[0] == 77) console.log('rx 77', decoded[1])
				if (LOGSERPHY) {
					console.log('SERPORT Rx')
					TS.logPacket(decoded)
				}
				serVPort.phy.receive(decoded)
			})
			// to ship, 
			serVPort.phy.send = (buffer) => {
				if(serVPort.recipRxBufSpace < 1){
					console.log("ZERO'd TRANSMISSION")
				} else {
					//console.log('tx at', serVPort.recipRxBufSpace)
					port.write(COBS.encode(buffer))
				}
				if (LOGSERPHY) {
					console.log('SERPORT Tx')
					TS.logPacket(buffer)
				}
			}
			// phy handle to close, 
			serVPort.phy.close = () => {
				console.log(`CLOSING #${pcount}`)
				serVPort.phy.status = EP.PORTSTATUS.CLOSING
				port.close(() => { // await close callback, add 1s buffer
					console.log(`SERPORT #${pcount} closed`) 
					serVPort.phy.status = EP.PORTSTATUS.CLOSED
				})
			}
		})
		port.on('error', (err) => {
			serVPort.phy.status = EP.PORTSTATUS.CLOSING
			console.log(`SERPORT #${pcount} ERR`, err)
			port.close(() => { // await close callback, add 1s buffer 
				console.log(`SERPORT #${pcount} CLOSED`)
				serVPort.phy.status = EP.PORTSTATUS.CLOSED
			})
		})
		port.on('close', (evt) => {
			console.log('FERME LA')
			serVPort.phy.status = EP.PORTSTATUS.CLOSED 
			console.log(`SERPORT #${pcount} closed`)
		})
	}).catch((err) => {
		if (LOGSEARCH) console.log(`SERPORT cannot find device at ${pid}`, err)
		serVPort.phy.status = EP.PORTSTATUS.CLOSED
	})
}

startSerialPort('8031')

serVPort.phy.open = () => {
	startSerialPort('8031')
}


/*
SerialPipe.start('8031').then((port) => {
  console.log('open ok, setup...')
  let ship = (arr) => {
    //console.log('encoding', arr)
    let encoded = COBS.encode(arr)
    // should be a zero-term'd buffer ?
    console.log('spcobs writing', encoded)
    port.write(encoded, 'utf8')
  }
  serialPortVPort.take(ship)
  port.on('error', (err) => {
    console.log('serialport err', err)
    process.exit()
  })
//  let parser = port.pipe(new ByteLength({length: 1}))
  let parser = port.pipe(new Delimiter({ delimiter: [0] }))
  parser.on('data', (buf) => {
    let decoded = COBS.decode(buf)
    let dcarr = []
    for(let i = 0; i < decoded.length; i ++){
      dcarr.push(decoded[i])
    }
    // ok, dcarr (decoded-array) is it,
    console.log('spcobs recv', dcarr)
    serialPortVPort.recv(dcarr)
  })
  // OK
  // now we need to write just a barebones COBS catch-and-rx
  // and then send some test packets thru the link, yeah?
  // .take(port) should actually be .take(send)
  // where let send = (arr) =>{cobs(arr)->port}
  // to test,
  // serialPortVPort.send([], [0, 2, 3]).then((ack) => {
  //   if (ack.msg[0] == PKEYS.ERR) {
  //     let str = String.fromCharCode.apply(null, ack.msg.splice(1))
  //     console.error('remote repl with error', str)
  //   } else {
  //     console.log('ok, port returns...', ack.msg, ack.route)
  //   }
  // }).catch((err) => {
  //   console.log(err)
  // })
}).catch((err) => {
  //
})
*/
