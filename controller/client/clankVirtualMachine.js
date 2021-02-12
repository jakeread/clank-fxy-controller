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
import MotorVM from './motorVirtualMachine.js'

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
    if (pos.E) {
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

  // endpoint to set per-axis accelerations,
  let accelEP = osap.endpoint()
  accelEP.addRoute(TS.route().portf(0).portf(1).end(), TS.endpoint(0, 5), 512)
  this.setAccels = (accels) => { // float array, len 4 XYZE 
    let wptr = 0
    let datagram = new Uint8Array(16)
    wptr += TS.write('float32', accels.X, datagram, wptr, true)
    wptr += TS.write('float32', accels.Y, datagram, wptr, true)
    wptr += TS.write('float32', accels.Z, datagram, wptr, true)
    if (accels.E) {
      wptr += TS.write('float32', accels.E, datagram, wptr, true)
    } else {
      wptr += TS.write('float32', 0, datagram, wptr, true)
    }
    return new Promise((resolve, reject) => {
      accelEP.write(datagram).then(() => {
        resolve()
      }).catch((err) => { reject(err) })
    })
  }

  let rateEP = osap.endpoint()
  rateEP.addRoute(TS.route().portf(0).portf(1).end(), TS.endpoint(0, 6), 512)
  this.setRates = (rates) => {
    // in firmware we think of mm/sec, 
    // in gcode and up here we think in mm/minute 
    // so conversion happens here 
    let wptr = 0
    let datagram = new Uint8Array(16)
    wptr += TS.write('float32', rates.X / 60, datagram, wptr, true)
    wptr += TS.write('float32', rates.Y / 60, datagram, wptr, true)
    wptr += TS.write('float32', rates.Z / 60, datagram, wptr, true)
    if (rates.E) {
      wptr += TS.write('float32', rates.E / 60, datagram, wptr, true)
    } else {
      wptr += TS.write('float32', 100, datagram, wptr, true)
    }
    return new Promise((resolve, reject) => {
      rateEP.write(datagram).then(() => {
        resolve()
      }).catch((err) => { reject(err) })
    })
  }

  // ------------------------------------------------------ MOTORS

  // clank cz:
  // AXIS   SPU     INVERT
  // X:     320     false
  // YL:    320     true
  // YR:    320     false
  // Z:     924.4r  false
  // E:     550     true 
  // per bondtech, for BMG on 16 microsteps, do 415: we are 32 microsteps 
  // https://www.bondtech.se/en/customer-service/faq/ 
  // however, this is measured & calibrated: 830 was extruding 75mm for a 50mm request 
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

  this.motors = {
    X: new MotorVM(osap, TS.route().portf(0).portf(1).busf(1, 1).end()),
    YL: new MotorVM(osap, TS.route().portf(0).portf(1).busf(1, 2).end()),
    YR: new MotorVM(osap, TS.route().portf(0).portf(1).busf(1, 3).end()),
    Z: new MotorVM(osap, TS.route().portf(0).portf(1).busf(1, 4).end()),
    E: new MotorVM(osap, TS.route().portf(0).portf(1).busf(1, 6).end()),
  }

  let motorCurrents = [0.5, 0.5, 0.5, 0.5, 0.5]
  this.setMotorCurrents = async () => {
    try {
      await this.motors.X.setCScale(motorCurrents[0])
      await this.motors.YL.setCScale(motorCurrents[1])
      await this.motors.YR.setCScale(motorCurrents[2])
      await this.motors.Z.setCScale(motorCurrents[3])
      //await this.motors.E.setCScale(motorCurrents[4])
    } catch (err) {
      console.error('bad motor current set')
      throw err
    }
  }

  // alias... 
  this.enableMotors = this.setMotorCurrents

  this.disableMotors = async () => {
    try {
      await this.motors.X.setCScale(0)
      await this.motors.YL.setCScale(0)
      await this.motors.YR.setCScale(0)
      await this.motors.Z.setCScale(0)
      await this.motors.E.setCScale(0)
    } catch (err) {
      console.error('bad motor disable set')
      throw err
    }
  }

  this.initMotors = async () => {
    // so, really, for these & the disable / enable / set current
    // could do them all parallel: like this halts if i.e. YL fails,
    // where it might just be that motor with an error... that'd be catching / continuing, accumulating
    // errors, and reporting them in a group 
    try {
      await this.motors.X.setAxisPick(0)
      await this.motors.X.setAxisInversion(false)
      await this.motors.X.setSPU(320)
    } catch (err) {
      console.error('bad x motor init')
      throw err
    }
    try {
      await this.motors.YL.setAxisPick(1)
      await this.motors.YL.setAxisInversion(true)
      await this.motors.YL.setSPU(320)
    } catch (err) {
      console.error('bad yl motor init')
      throw err
    }
    try {
      await this.motors.YR.setAxisPick(1)
      await this.motors.YR.setAxisInversion(false)
      await this.motors.YR.setSPU(320)
    } catch (err) {
      console.error('bad yr motor init')
      throw err
    }
    try {
      await this.motors.Z.setAxisPick(2)
      await this.motors.Z.setAxisInversion(false)
      await this.motors.Z.setSPU(924.444444)
    } catch (err) {
      console.error('bad z motor init')
      throw err
    }
    /*
    try {
      await this.motors.E.setAxisPick(3)
      await this.motors.E.setAxisInversion(true)
      await this.motors.E.setSPU(550)
    } catch (err) {
      console.error('bad e motor init')
      throw err
    }
    */
    await this.setMotorCurrents()
  }

  // ------------------------------------------------------ TOOLCHANGER

  let tcServoEP = osap.endpoint()
  tcServoEP.addRoute(TS.route().portf(0).portf(1).busf(1, 5).end(), TS.endpoint(0, 0), 512)

  this.setTCServo = (micros) => {
    let wptr = 0
    let datagram = new Uint8Array(4)
    // write micros 
    wptr += TS.write('uint32', micros, datagram, wptr, true)
    // do the shipment
    return new Promise((resolve, reject) => {
      tcServoEP.write(datagram).then(() => {
        console.warn('tc set', micros)
        resolve()
      }).catch((err) => {
        reject(err)
      })
    })
  }

  this.openTC = () => {
    return this.setTCServo(2000)
  }

  this.closeTC = () => {
    return this.setTCServo(875)
  }

  // ------------------------------------------------------ TOOL CHANGING

  // tool localization for put-down & pickup, tool statefulness, 
  // from back left 0,0 
  // put-down HE at (23.8, -177) -> (23.8, -222.6) -> release -> (-17.8, -208.6) clear -> (-17.8, -183)
  // { position: {X: num, Y: num, Z: num}, rate: num }

  let delay = (ms) => {
    return new Promise((resolve, reject) => {
      setTimeout(() => { resolve() }, ms)
    })
  }

  this.delta = async (move, rate) => {
    try {
      if (!rate) rate = 6000
      await this.setWaitTime(1)
      await delay(5)
      await this.awaitMotionEnd()
      let cp = await this.getPos()
      console.log('current', cp)
      await this.addMoveToQueue({
        position: { X: cp.X + move[0], Y: cp.Y + move[1], Z: cp.Z + move[2] },
        rate: rate
      })
      await delay(5)
      await this.awaitMotionEnd()
      await this.setWaitTime(100)
    } catch (err) {
      console.error('arising during delta')
      throw err
    }
  }

  this.goto = async (pos, rate) => {
    try {
      if (!rate) rate = 6000
      // set remote queue-wait-time 
      await this.setWaitTime(1)
      await delay(5)
      // wait for the stop 
      await this.awaitMotionEnd()
      await this.addMoveToQueue({
        position: { X: pos[0], Y: pos[1], Z: pos[2], E: 0 },
        rate: rate
      })
      await delay(5)
      await this.awaitMotionEnd()
      await this.setWaitTime(100)
    } catch (err) {
      console.error('during goto')
      throw err
    }
  }

  let tools = [{
    pickX: 16.8,
    pickY: -177,
    plunge: -45.6
  }]

  this.dropTool = async (num) => {
    try {
      await this.awaitMotionEnd()
      await this.closeTC()
      let cp = await this.getPos()
      await this.goto([tools[num].pickX, tools[num].pickY, cp.Z])
      console.warn('done setup')
      await this.delta([0, tools[num].plunge, 0])
      await this.openTC()
      await delay(250)
      console.warn('tc open')
      await this.delta([-6, 10, 0])
      await this.delta([0, 50, 0])
      await this.goto([tools[num].pickX, tools[num].pickY, cp.Z])
    } catch (err) {
      console.error(`at T${num} drop`)
      throw err
    }
  }

  this.pickTool = async (num) => {
    try {
      await this.awaitMotionEnd()
      await this.openTC()
      let cp = await this.getPos()
      await this.goto([tools[num].pickX, tools[num].pickY, cp.Z])
      await this.delta([-6, 0, 0])
      await this.delta([0, tools[num].plunge + 10, 0])
      await this.delta([6, -10, 0])
      await this.closeTC()
      await delay(250)
      await this.delta([0, -tools[num].plunge, 0])
      await delay(250)
    } catch (err) {
      console.error(`at T${num} pick`)
      throw err
    }
  }

  // ------------------------------------------------------ HEATER JUNK 

  this.tvm = []
  this.tvm[0] = new TempVM(osap, TS.route().portf(0).portf(1).busf(1, 7).end())
  this.tvm[1] = new TempVM(osap, TS.route().portf(0).portf(1).busf(1, 9).end())

}