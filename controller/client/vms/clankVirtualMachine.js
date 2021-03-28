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

import { PK, TS, VT, EP, TIMES } from '../../osapjs/core/ts.js'
import MotionVM from './motionVirtualMachine.js'
import LoadVM from './loadcellVirtualMachine.js'
import MotorVM from './motorVirtualMachine.js'
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

/* cz-head
0: serialport 
1: bus head
2: add to move queue 
3: set position 
4: get position 
*/

export default function ClankVM(osap) {

  // ------------------------------------------------------ MOTION
  // with base route -> embedded smoothie instance 
  this.motion = new MotionVM(osap, PK.route().sib(0).pfwd().sib(1).pfwd().end())

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
    X: new MotorVM(osap, PK.route().sib(0).pfwd().sib(1).pfwd().sib(1).bfwd(1).end()),    // 1
    YL: new MotorVM(osap, PK.route().sib(0).pfwd().sib(1).pfwd().sib(1).bfwd(2).end()),   // 2
    YR: new MotorVM(osap, PK.route().sib(0).pfwd().sib(1).pfwd().sib(1).bfwd(3).end()),   // 3
    Z: new MotorVM(osap, PK.route().sib(0).pfwd().sib(1).pfwd().sib(1).bfwd(4).end()),    // 4
    E: new MotorVM(osap, PK.route().sib(0).pfwd().sib(1).pfwd().sib(1).bfwd(6).end()),    // 6
  }

  let motorCurrents = [0.5, 0.5, 0.5, 0.5, 0.5]
  this.setMotorCurrents = async () => {
    try {
      await this.motors.X.setCScale(motorCurrents[0])
      await this.motors.YL.setCScale(motorCurrents[1])
      await this.motors.YR.setCScale(motorCurrents[2])
      await this.motors.Z.setCScale(motorCurrents[3])
      await this.motors.E.setCScale(motorCurrents[4])
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
    try {
      await this.motors.E.setAxisPick(3)
      await this.motors.E.setAxisInversion(true)
      await this.motors.E.setSPU(550)
    } catch (err) {
      console.error('bad e motor init')
      throw err
    }
    await this.setMotorCurrents()
  }

  /*

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

  // ------------------------------------------------------ LOADCELL 

  this.loadcell = new LoadVM(osap, TS.route().portf(0).portf(1).busf(1, 8).end())
  let readings = [
    [-124000, -137000, -147000, -159000, -171000, -184000, -195000, -225000, -350000],
    [0, -50, -100, -150, -200, -250, -300, -500, -1000]]
  this.loadcell.setObservations(readings, 'grams')

  // this.pullExtruderTest = () => {
  //   return new Promise((resolve, reject) => {
  //     let res = {
  //       temp: undefined, 
  //       speed: undefined,
  //       load: undefined
  //     }
  //     this.tvm[0].getExtruderTemp().then((temp) => {
  //       res.temp = temp
  //       return delay(10)
  //     }).then(() => {
  //       return this.getSpeeds()
  //     }).then((speeds) => {
  //       res.speed = speeds.E 
  //       return delay(10)
  //     }).then(() => {
  //       return this.loadcell.getReading()
  //     }).then((load) => {
  //       res.load = load
  //       resolve(res)
  //     }).catch((err) => {
  //       reject(err)
  //     })
  //   })
  // }

  this.pullExtruderTest = () => {
    return new Promise((resolve, reject) => {
      let res = {
        temp: undefined, 
        speed: undefined,
        load: undefined
      }
      let resolved = false 
      let checkRes = () => {
        if(resolved) return 
        if(res.temp != undefined && res.speed != undefined && res.load != undefined){
          resolved = true 
          resolve(res)
        }
      }
      this.tvm[0].getExtruderTemp().then((temp) => {
        res.temp = temp 
        checkRes()
      }).catch((err) => { reject(err) })
      this.getSpeeds().then((speeds) => {
        res.speed = speeds.E
        checkRes()
      }).catch((err) => { reject(err) })
      this.loadcell.getReading().then((newtons) => {
        res.load = newtons
        checkRes()
      }).catch((err) => { reject(err) })
    })
  }
  */
} // end clank vm 