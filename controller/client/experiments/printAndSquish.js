/*
printAndSquish.js

NIST expriment automation 

Jake Read at the Center for Bits and Atoms
(c) Massachusetts Institute of Technology 2021

This work may be reproduced, modified, distributed, performed, and
displayed for any purpose, but must acknowledge the open systems assembly protocol (OSAP) project.
Copyright is retained and must be preserved. The work is provided as is;
no warranty is provided, and users accept all liability.
*/

import { TIMES } from "../../osapjs/core/ts.js"
import { SaveFile } from "../../osapjs/client/utes/saveFile.js"

export default function PNS(machine, hotend, bed, loadcells, gpanel) {
  // ... 
  this.runTest = async (temp, rate) => {
    // await no motion (?) 
    try {
      // test code, so:
      //console.warn("TEST: no e moves")
      //machine.motors.E.disable()
      // await temp, 
      console.warn("PNS: awaiting extruder temp...")
      await hotend.awaitExtruderTemp(temp)
      console.warn("PNS: homing...")
      await machine.home()
      console.warn("PNS: loading test file...")
      //await gpanel.loadServerFile('save/3p30mm_introTest.gcode')
      await gpanel.loadServerFile('save/2021-10-18_pacman-02.gcode')
      // GOTO 0,0,1 b4 start 
      console.warn("PNS: going to start pos,")
      await machine.motion.goTo({
        position: { X: 170, Y: 0, Z: 1 },
        rate: 100
      })
      await TIMES.delay(55)
      await machine.motion.setPos({
        X: 0, Y: 0, Z: 1
      })
      await TIMES.delay(55)
      // set a speed override... 
      console.warn(`PNS: overriding all rates to ${rate}`)
      machine.motion.overrideAllRates(rate)
      console.warn("PNS: running file...")
      await gpanel.start()
      console.warn("PNS: file done, now we squish...")
      await TIMES.delay(55)
      // right edge of HE is ~ 28.5mm right of nozzle, 
      // and ~ 38mm back, 
      let pos = await machine.motion.getPos()
      await TIMES.delay(55)
      // shutdown the hotend, as a treat: 
      console.warn("PNS: shutting down hotend")
      await hotend.setExtruderTemp(0)
      // now we go to this cooling step, 
      console.warn("PNS: part-fan-cooling-cooling")
      await machine.motion.goTo({
        position: { X: 10, Y: -10, Z: pos.Z }, 
        rate: 15
      })
      for(let cd = 60; cd > 0; cd --){
        console.warn(`PNS: cooldown ${cd}`)
        await TIMES.delay(1000)
      }
      // gcode pulls *up* by 10mm, so we come back down... 
      await machine.motion.goTo({
        position: { X: -24, Y: -36, Z: pos.Z - 10 },
        rate: 15
      })
      // by here we should actually be ready to squish, no whey 
      // quit rate override,
      machine.motion.stopRateOverride()
      await loadcells.tare()
      // setup to traverse some mm... 
      let motionComplete = false
      let results = []
      machine.motion.delta([0, 0, -15], 0.5).then(() => {
        motionComplete = true
      }).catch((err) => {
        motionComplete = true
        throw err
      })
      await TIMES.delay(250)
      while (!motionComplete) {
        let load = loadcells.getReading()
        let pos = machine.motion.getPos()
        load = await load
        pos = await pos
        results.push([pos.Z, load.reduce((p, c) => { return p + c }) / 3])
      }
      SaveFile(results, 'json', `pns_${temp}_${rate}`)
      console.warn(results)
    } catch (err) {
      console.error(err)
    }
  }
}