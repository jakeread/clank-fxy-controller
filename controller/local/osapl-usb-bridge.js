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
import OSAP from '../osapjs/core/osap.js'
import { TS, EP, PK } from '../osapjs/core/ts.js'

import WSSPipe from './utes/wssPipe.js'

import SerialPort from 'serialport'
import Delimiter from '@serialport/parser-delimiter'
import ByteLength from '@serialport/parser-byte-length'

import COBS from './utes/cobs.js'


let LOGPHY = false

// we include an osap object - a node
let osap = new OSAP()
osap.name = "local-usb-bridge"
osap.description = "node featuring wss to client and usbserial cobs connection to hardware"

// -------------------------------------------------------- WSS VPort

// 'common node highwatermark'
// https://nodejs.org/es/docs/guides/backpressuring-in-streams/
// and we want to have two ports,
// one a websocket server, this part of our bootstrap situation...
let wssVPort = osap.vPort() // yeah, go this
wssVPort.name = "websocket server"
wssVPort.maxSegLength = 16384

WSSPipe.start().then((ws) => {
	// no loop or init code, 
	// implement status 
	let status = EP.PORTSTATUS.OPEN
	wssVPort.status = () => { return status }
	// implement rx,
	ws.onmessage = (msg) => {
		if (LOGPHY) console.log('PHY WSS Recv')
		if (LOGPHY) TS.logPacket(msg.data)
		wssVPort.receive(msg.data)
	}
	// implement transmit 
	wssVPort.send = (buffer) => {
		if (LOGPHY) console.log('PHY WSS Send')
		if (LOGPHY) TS.logPacket(buffer)
		ws.send(buffer)
	}
	// code if osap wants to close this link 
	wssVPort.requestClose = () => {
		ws.terminate()
		status = EP.PORTSTATUS.CLOSING
	}

	// local to us, 
	ws.onerror = (err) => {
		status = EP.PORTSTATUS.CLOSED
		console.log('wss error', err)
	}
	ws.onclose = (evt) => {
		status = EP.PORTSTATUS.CLOSED
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
serVPort.maxSegLength = 1024 // lettuce do this for embedded expectations

let LOGSER = false
let LOGSERPHY = false

let findSerialPort = (pid) => {
	if (LOGSER) console.log(`SERPORT hunt for productId: ${pid}`)
	return new Promise((resolve, reject) => {
		SerialPort.list().then((ports) => {
			let found = false
			for (let port of ports) {
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

// options: passthrough for node-serialport API
let startSerialPort = (pid, options) => {
	// implement status 
	let status = EP.PORTSTATUS.OPENING
	serVPort.status = () => { return status }
	// open up, 
	findSerialPort(pid).then((com) => {
		if (true) console.log(`SERPORT contact at ${com}, opening`)
		let port = new SerialPort(com, options)
		let pcount = opencount
		opencount++
		port.on('open', () => {
			console.log(`SERPORT at ${com} #${pcount} OPEN`)
			// is now open, 
			status = EP.PORTSTATUS.OPEN
			// to get, use delimiter
			let parser = port.pipe(new Delimiter({ delimiter: [0] }))
			//let parser = port.pipe(new ByteLength({ length: 1 }))
			// implement rx
			parser.on('data', (buf) => {
				let decoded = COBS.decode(buf)
				//if(decoded[0] == 77) console.log('rx 77', decoded[1])
				if (LOGSERPHY) {
					console.log('SERPORT Rx')
					TS.logPacket(decoded)
				}
				serVPort.receive(decoded)
			})
			// implement tx 
			serVPort.send = (buffer) => {
				port.write(COBS.encode(buffer))
				if (LOGSERPHY) {
					console.log('SERPORT Tx')
					TS.logPacket(buffer)
				}
			}
			// phy handle to close, 
			serVPort.requestClose = () => {
				console.log(`CLOSING #${pcount}`)
				status = EP.PORTSTATUS.CLOSING
				port.close(() => { // await close callback, add 1s buffer
					console.log(`SERPORT #${pcount} closed`)
					status = EP.PORTSTATUS.CLOSED
				})
			}
		}) // end on-open 
		port.on('error', (err) => {
			status = EP.PORTSTATUS.CLOSING
			console.log(`SERPORT #${pcount} ERR`, err)
			port.close(() => { // await close callback, add 1s buffer 
				console.log(`SERPORT #${pcount} CLOSED`)
				status = EP.PORTSTATUS.CLOSED
			})
		})
		port.on('close', (evt) => {
			console.log('FERME LA')
			status = EP.PORTSTATUS.CLOSED
			console.log(`SERPORT #${pcount} closed`)
		})
	}).catch((err) => {
		if (LOGSER) console.log(`SERPORT cannot find device at ${pid}`, err)
		status = EP.PORTSTATUS.CLOSED
	})
} // end start serial

startSerialPort('8031')

serVPort.requestOpen = () => {
	startSerialPort('8031')
}
