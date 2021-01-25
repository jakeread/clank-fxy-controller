/*
clankVirtualMachine.js

vm for Clank-CZ

Jake Read at the Center for Bits and Atoms
(c) Massachusetts Institute of Technology 2021

This work may be reproduced, modified, distributed, performed, and
displayed for any purpose, but must acknowledge the open systems assembly protocol (OSAP) project.
Copyright is retained and must be preserved. The work is provided as is;
no warranty is provided, and users accept all liability.
*/

import { TS, PK, DK, AK, EP } from '../osapjs/core/ts.js'
import TempVM from './tempVirtualMachine.js'

/* bus ID (osap maps +1)
X:    0 
YL:   1
YR:   2, term
Z:    3 
TCS:  4
E:    5
HE:   6
LC:   7
BED:  8
*/

export default function ClankVM(osap, route) {

  // ------------------------------------------------------ MOTION
  // ok: we make an 'endpoint' that will transmit moves,
  let moveEP = osap.endpoint()
  // add the machine head's route to it, 
  moveEP.addRoute(TS.route().portf(0).portf(1).end(), TS.endpoint(0, 1), 512)
  // and set a long timeout,
  moveEP.setTimeoutLength(60000)
  // move like: { position: {X: num, Y: num, Z: num}, rate: num }
  this.addMoveToQueue = (move) => {
    // write the gram, 
    let wptr = 0
    let datagram = new Uint8Array(20)
    // write rate 
    wptr += TS.write('float32', move.rate, datagram, wptr, true)
    // write posns 
    wptr += TS.write('float32', move.position.X, datagram, wptr, true)
    wptr += TS.write('float32', move.position.Y, datagram, wptr, true)
    wptr += TS.write('float32', move.position.Z, datagram, wptr, true)
    if (move.position.E) {
      //console.log(move.position.E)
      wptr += TS.write('float32', move.position.E, datagram, wptr, true)
    } else {
      wptr += TS.write('float32', 0, datagram, wptr, true)
    }
    // do the networking, 
    return new Promise((resolve, reject) => {
      moveEP.write(datagram).then(() => {
        resolve()
      }).catch((err) => {
        reject(err)
      })
    })
  }

  // to set the current position, 
  let setPosEP = osap.endpoint()
  setPosEP.addRoute(TS.route().portf(0).portf(1).end(), TS.endpoint(0, 2), 512)
  setPosEP.setTimeoutLength(10000)
  this.setPos = (pos) => {
    let wptr = 0 
    let datagram = new Uint8Array(16)
    wptr += TS.write('float32', pos.X, datagram, wptr, true)
    wptr += TS.write('float32', pos.Y, datagram, wptr, true)
    wptr += TS.write('float32', pos.Z, datagram, wptr, true)
    if(pos.E){
      wptr += TS.write('float32', pos.E, datagram, wptr, true)
    } else {
      wptr += TS.write('float32', 0, datagram, wptr, true)
    }
    // ship it 
    return new Promise((resolve, reject) => {
      setPosEP.write(datagram).then(() => {
        resolve()
      }).catch((err) => { reject(err) })
    })
  }

  // an a 'query' to check current position 
  let posQuery = osap.query(TS.route().portf(0).portf(1).end(), TS.endpoint(0, 2), 512)
  this.getPos = () => {
    return new Promise((resolve, reject) => {
      posQuery.pull().then((data) => {
        let pos = {
          X: TS.read('float32', data, 0, true),
          Y: TS.read('float32', data, 4, true),
          Z: TS.read('float32', data, 8, true),
          E: TS.read('float32', data, 12, true)
        }
        resolve(pos)
      }).catch((err) => { reject(err) })
    })
  }

  // another query to see if it's currently moving, 
  // update that endpoint so we can 'write halt' / 'write go' with a set 
  let motionQuery = osap.query(TS.route().portf(0).portf(1).end(), TS.endpoint(0, 3), 512)
  this.awaitMotionEnd = () => {
    return new Promise((resolve, reject) => {
      let check = () => {
        motionQuery.pull().then((data) => {
          if (data[0] > 0) {
            setTimeout(check, 50)
          } else {
            resolve()
          }
        }).catch((err) => {
          reject(err)
        })
      }
      setTimeout(check, 50)
    })
  }

  // an endpoint to write 'wait time' on the remote,
  let waitTimeEP = osap.endpoint()
  waitTimeEP.addRoute(TS.route().portf(0).portf(1).end(), TS.endpoint(0, 4), 512)
  this.setWaitTime = (ms) => {
    return new Promise((resolve, reject) => {
      let datagram = new Uint8Array(4)
      TS.write('uint32', ms, datagram, 0, true)
      waitTimeEP.write(datagram).then(() => {
        resolve()
      }).catch((err) => { reject(err) })
    })
  }

  // ------------------------------------------------------ HEATER JUNK 

  this.tvm = []
  this.tvm[0] = new TempVM(osap, TS.route().portf(0).portf(1).busf(1,7).end())
  this.tvm[1] = new TempVM(osap, TS.route().portf(0).portf(1).busf(1,9).end())

  // ------------------------------------------------------ TOOLCHANGER

  let tcServoEP = osap.endpoint()
  tcServoEP.addRoute(TS.route().portf(0).portf(1).busf(1, 4).end(), TS.endpoint(0, 0), 512)

  this.setTCServo = (micros) => {
    console.warn(micros)
    let wptr = 0
    let datagram = new Uint8Array(4)
    // write micros 
    wptr += TS.write('uint32', micros, datagram, wptr, true)
    // do the shipment
    return new Promise((resolve, reject) => {
      tcServoEP.write(datagram).then(() => {
        resolve()
      }).catch((err) => {
        reject(err)
      })
    })
  }

}