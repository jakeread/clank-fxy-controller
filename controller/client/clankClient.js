/*
clank-client.js

clank controller client side

Jake Read at the Center for Bits and Atoms
(c) Massachusetts Institute of Technology 2020

This work may be reproduced, modified, distributed, performed, and
displayed for any purpose, but must acknowledge the open systems assembly protocol (OSAP) project.
Copyright is retained and must be preserved. The work is provided as is;
no warranty is provided, and users accept all liability.
*/

'use strict'

import OSAP from '../osapjs/core/osapRoot.js'
import { PK, TS, VT, EP } from '../osapjs/core/ts.js'

// the clank 'virtual machine'
import ClankVM from './vms/clankVirtualMachine.js'

import Grid from '../osapjs/client/interface/grid.js' // main drawing API 
import { GCodePanel } from '../osapjs/client/components/gCodePanel.js'
import { AutoPlot } from '../osapjs/client/components/autoPlot.js'
import { Button } from '../osapjs/client/interface/button.js'
import { TextInput } from '../osapjs/client/interface/textInput.js'
import { JogBox } from '../osapjs/client/components/jogBox.js'
import { SaveFile } from '../osapjs/client/utes/saveFile.js'
import TempPanel from '../osapjs/client/components/tempPanel.js'
import TempVM from './vms/tempVirtualMachine.js'
import LoadVM from './vms/loadcellVirtualMachine.js'
import LoadPanel from '../osapjs/client/components/loadPanel.js'
import FilamentExperiment from '../osapjs/client/components/filamentExperiment.js'

console.log("hello clank controller")

// the osap root node:
let osap = new OSAP()

let grid = new Grid()

// -------------------------------------------------------- SETUP NETWORK / PORT 

let wscVPort = osap.vPort()

let LOGPHY = false

// to test these systems, the client (us) will kickstart a new process
// on the server, and try to establish connection to it.
console.log("making client-to-server request to start remote process,")
console.log("and connecting to it w/ new websocket")
// ok, let's ask to kick a process on the server,
// in response, we'll get it's IP and Port,
// then we can start a websocket client to connect there,
// automated remote-proc. w/ vPort & wss medium,
// for args, do '/processName.js?args=arg1,arg2'

jQuery.get('/startLocal/osapSerialBridge.js', (res) => {
  if (res.includes('OSAP-wss-addr:')) {
    let addr = res.substring(res.indexOf(':') + 2)
    if (addr.includes('ws://')) {
      let status = "opening"
      wscVPort.cts = () => {
        if (status == "open") {
          return true
        } else {
          return false
        }
      }
      // start up, 
      console.log('starting socket to remote at', addr)
      let ws = new WebSocket(addr)
      ws.binaryType = "arraybuffer"
      // opens, 
      ws.onopen = (evt) => {
        status = "open"
        // implement rx
        ws.onmessage = (msg) => {
          let uint = new Uint8Array(msg.data)
          wscVPort.receive(uint)
        }
        // implement tx 
        wscVPort.send = (buffer) => {
          if (LOGPHY) console.log('PHY WSC Send', buffer)
          ws.send(buffer)
        }
      }
      ws.onerror = (err) => {
        status = "closed"
        console.log('sckt err', err)
      }
      ws.onclose = (evt) => {
        status = "closed"
        console.log('sckt closed', evt)
      }
    }
  } else {
    console.error('remote OSAP not established', res)
  }
})

// -------------------------------------------------------- THE VM

// vm, 
let vm = new ClankVM(osap)

// adhoc test two temp ends, 

let tempx0 = new TempVM(osap, PK.route().sib(0).pfwd().sib(1).pfwd().sib(1).bfwd(1).end())
let tempx1 = new TempVM(osap, PK.route().sib(0).pfwd().sib(1).pfwd().sib(1).bfwd(2).end())

let tstBtn = new Button(350, 350, 104, 24, "test")
tstBtn.onClick(() => {
  tempx0.getExtruderTemp().then((temp) => {
    console.warn('tempx0', temp)
  }).catch((err) => {
    console.error(err)
  })
  tempx1.getExtruderTemp().then((temp) => {
    console.warn('tempx1', temp)
  }).catch((err) => {
    console.error(err)
  })
})

// -------------------------------------------------------- MOTION FEED

// panel, 
let gCodePanel = new GCodePanel(vm, 10, 10)

// init... 
let initBtn = new Button(250, 10, 84, 104, 'init')
initBtn.onClick(() => {
  setupMotion().then(() => {
    console.log('setup motor')
    return vm.initMotors()
  }).then(() => {
    return hotendVm.setPIDTerms([-0.25, 0, -0.5])
  }).then(() => {
    initBtn.good('ok', 500)
  }).catch((err) => {
    console.error(err)
    initBtn.bad("err", 500)
  })
})

let setStartBtn = new Button(250, 130, 84, 14, 'offset zero')
setStartBtn.onClick(() => {
  vm.motion.setPos({
    X: 0,
    Y: 0,
    Z: 121.8,
    E: 0
  }).then(() => {
    setStartBtn.good("ok", 500)
  }).catch((err) => {
    console.error(err)
    setStartBtn.bad("err", 500)
  })
})

// jog, 
let jogBox = new JogBox(250, 170, vm)

// rates / accel setup 
let ratesXpos = 250 
let ratesYpos = 410
let setRatesBtn = new Button(ratesXpos, ratesYpos, 84, 24, 'set acc & max fr')
let accText = new Button(ratesXpos, ratesYpos + 40, 84, 14, 'mm/sec^2')
let xAccVal = new TextInput(ratesXpos, ratesYpos + 70, 90, 20, '5000')
let yAccVal = new TextInput(ratesXpos, ratesYpos + 100, 90, 20, '5000')
let zAccVal = new TextInput(ratesXpos, ratesYpos + 130, 90, 20, '500')
let eAccVal = new TextInput(ratesXpos, ratesYpos + 160, 90, 20, '1000')

let rateText = new Button(ratesXpos, ratesYpos + 190, 84, 14, 'mm/min')
let xRateVal = new TextInput(ratesXpos, ratesYpos + 220, 90, 20, '12000')
let yRateVal = new TextInput(ratesXpos, ratesYpos + 250, 90, 20, '12000')
let zRateVal = new TextInput(ratesXpos, ratesYpos + 280, 90, 20, '1000')
let eRateVal = new TextInput(ratesXpos, ratesYpos + 310, 90, 20, '60000')

let setupMotion = () => {
  // accel 
  let aVals = {
    X: parseFloat(xAccVal.value),
    Y: parseFloat(yAccVal.value),
    Z: parseFloat(zAccVal.value),
    E: parseFloat(eAccVal.value)
  }
  for (let v in aVals) {
    if (Number.isNaN(aVals[v])) { console.error('bad parse for float', v); return }
  }
  // rates
  let rVals = {
    X: parseFloat(xRateVal.value),
    Y: parseFloat(yRateVal.value),
    Z: parseFloat(zRateVal.value),
    E: parseFloat(eRateVal.value)
  }
  for (let v in rVals) {
    if (Number.isNaN(rVals[v])) { console.error('bad parse for float', r); return }
  }
  // network 
  return new Promise((resolve, reject) => {
    console.log('setting accels')
    vm.motion.setAccels(aVals).then(() => {
      console.log('setting rates')
      return vm.motion.setRates(rVals)
    }).then(() => {
      resolve()
    }).catch((err) => { reject(err) })
  })
}

// -------------------------------------------------------- TEMP CONTROLLER 

// working into temps:

let hotendVm = new TempVM(osap, PK.route().sib(0).pfwd().sib(1).pfwd().sib(1).bfwd(6).end())
//let hotendPanel = new TempPanel(hotendVm, 350, 10, 220, "hotend")

let bedVm = new TempVM(osap, PK.route().sib(0).pfwd().sib(1).pfwd().sib(1).bfwd(9).end())
//let bedPanel = new TempPanel(bedVm, 350, 420, 70, "bed")

// -------------------------------------------------------- LOADCELL CONTROLLER

let loadcellVm = new LoadVM(osap, PK.route().sib(0).pfwd().sib(1).pfwd().sib(1).bfwd(7).end())
//let loadPanel = new LoadPanel(loadcellVm, 350, 830, "HE loadcell")
let readings = [
  [-124000, -137000, -147000, -159000, -171000, -184000, -195000, -225000, -350000],
  [0, -50, -100, -150, -200, -250, -300, -500, -1000]];
loadcellVm.setObservations(readings, 'grams')

// -------------------------------------------------------- Filament Data Gen 

let dataGen = new FilamentExperiment(vm, hotendVm, loadcellVm, 350, 10)

/*
// this is... kind of buggy. button state sometimes straightforwards, sometimes callback hell 
let posBtn = new Button(430, 10, 344, 14, 'pos')
let posLp = false
posBtn.onClick(() => {
  if (posLp) {
    posLp = false
    posBtn.good("stop", 500)
  } else {
    let posPoll = () => {
      if (!posLp) return
      vm.motion.getPos().then((pos) => {
        if (posLp) {
          $(posBtn.elem).text(`X: ${pos.X.toFixed(2)}, Y: ${pos.Y.toFixed(2)}, Z: ${pos.Z.toFixed(2)}, E: ${pos.E.toFixed(2)}`)
          setTimeout(posPoll, 50)
        }
      }).catch((err) => {
        posLp = false
        console.error(err)
        posBtn.bad("err", 1000)
      })
    }
    posLp = true
    posPoll()
  }
})

let speedBtn = new Button(430, 40, 344, 14, 'speed')
let speedLp = false
speedBtn.onClick(() => {
  if (speedLp) {
    speedLp = false
    speedBtn.good("stop", 500)
  } else {
    let poll = () => {
      if (!speedLp) return
      vm.motion.getSpeeds().then((speed) => {
        if (speedLp) {
          $(speedBtn.elem).text(`X: ${speed.X.toFixed(2)}, Y: ${speed.Y.toFixed(2)}, Z: ${speed.Z.toFixed(2)}, E: ${speed.E.toFixed(2)}`)
          setTimeout(poll, 50)
        }
      }).catch((err) => {
        speedLp = false
        console.error(err)
        speedBtn.bad("err", 1000)
      })
    }
    speedLp = true
    poll()
  }
})

let gotoZeroBtn = new Button(360, 160, 94, 14, 'goto zero')
gotoZeroBtn.onClick(() => {
  vm.motion.addMoveToQueue({
    rate: 600,
    position: {
      X: 0,
      Y: 0,
      Z: 0,
      E: 0,
    }
  }).then(() => {
    gotoZeroBtn.good("ok", 500)
  }).catch((err) => {
    console.error(err)
    gotoZeroBtn.bad("err", 500)
  })
})

// -------------------------------------------------------- EXTRUDER TEST

let testStartBtn = new Button(240, 190, 104, 14, 'e test')
let tempPlot = new AutoPlot(360, 190, 420, 200, 'temp (deg c)')
tempPlot.setHoldCount(1000)
let speedPlot = new AutoPlot(360, 400, 420, 200, 'e speed (mm/min)')
speedPlot.setHoldCount(1000)
let loadPlot = new AutoPlot(360, 620, 420, 200, 'e load (n)')
loadPlot.setHoldCount(1000)
let tstLp = false
let eTestLpCnt = 0 
let eTestStore = {
  temps: [],
  speeds: [],
  loads: []
}
testStartBtn.onClick(() => {
  if(tstLp){
    tstLp = false 
    return 
  }
  let lp = () => {
    if(!tstLp){
      testStartBtn.bad("fin", 500)
      console.log(eTestStore)
      //SaveFile(eTestStore, 'json', 'extruderTestData.json')
      return 
    }
    vm.pullExtruderTest().then((res) => {
      eTestLpCnt ++ 
      tempPlot.pushPt([eTestLpCnt, res.temp])
      speedPlot.pushPt([eTestLpCnt, res.speed])
      loadPlot.pushPt([eTestLpCnt, res.load])
      //if(eTestLpCnt % 1 == 0){
        tempPlot.redraw()
        speedPlot.redraw()
        loadPlot.redraw()
      //}
      eTestStore.temps.push(res.temp)
      eTestStore.speeds.push(res.speed)
      eTestStore.loads.push(res.load)
      setTimeout(lp, 0)
    }).catch((err) => {
      console.error(err)
      setTimeout(lp, 10)
    })
  }
  tstLp = true 
  lp()
})

// -------------------------------------------------------- MOTION SETTINGS
// todo: should bundle with jog, position query, etc ? or get on with other work 

setRatesBtn.onClick(() => {
  setupMotion().then(() => {
    setRatesBtn.good("ok", 500)
  }).catch((err) => {
    console.error(err)
    setRatesBtn.bad("err", 500)
  })
})

// -------------------------------------------------------- MOTOR SETTINGS

let setMotorsBtn = new Button(790, 360, 84, 14, 'motor setup')
setMotorsBtn.onClick(() => {
  vm.initMotors().then(() => {
    setMotorsBtn.good("ok", 500)
  }).catch((err) => {
    console.error(err)
    setMotorsBtn.bad("err", 500)
  })
})

let disableMotorsBtn = new Button(790, 390, 84, 14, 'disable')
disableMotorsBtn.onClick(() => {
  vm.disableMotors().then(() => {
    disableMotorsBtn('ok', 500)
  }).catch((err) => {
    console.error(err)
    disableMotorsBtn.bad("err", 500)
  })
})

let enableMotorsBtn = new Button(790, 420, 84, 14, 'enable')
enableMotorsBtn.onClick(() => {
  vm.enableMotors().then(() => {
    enableMotorsBtn('ok', 500)
  }).catch((err) => {
    console.error(err)
    enableMotorsBtn.bad("err", 500)
  })
})

// -------------------------------------------------------- MACHINE INIT

let initMachineBtn = new Button(470, 130, 84, 44, 'init vm')
initMachineBtn.onClick(() => {
  setupMotion().then(() => {
    return vm.initMotors()
  }).then(() => {
    initMachineBtn.good("ok", 500)
  }).catch((err) => {
    console.error(err)
    initMachineBtn.bad("err", 500)
  })
})

// -------------------------------------------------------- TOOLCHANGER 

let tcBtn = new Button(540, 70, 94, 14, 'tc')
tcBtn.onClick(() => {
  if ($(tcBtn.elem).text() == 'close tc') {
    vm.closeTC().then(() => {
      tcBtn.good('ok', 500)
      setTimeout(() => {
        $(tcBtn.elem).text('open tc')
      }, 500)
    }).catch((err) => {
      console.error(err)
      tcBtn.bad('err', 500)
      setTimeout(() => {
        $(tcBtn.elem).text('close tc')
      }, 500)
    })
  } else {
    vm.openTC().then(() => {
      tcBtn.good('ok', 500)
      setTimeout(() => {
        $(tcBtn.elem).text('close tc')
      }, 500)
    }).catch((err) => {
      console.error(err)
      tcBtn.bad('err', 500)
      setTimeout(() => {
        $(tcBtn.elem).text('open tc')
      }, 500)
    })
  }
})
$(tcBtn.elem).text('close tc')

let dropBtn = new Button(430, 70, 94, 14, 'drop T0')
dropBtn.onClick(() => {
  vm.dropTool(0).then(() => {
    dropBtn.good("ok", 500)
  }).catch((err) => {
    console.error(err)
    dropBtn.bad("err", 500)
  })
})

let pickupBtn = new Button(430, 100, 94, 14, 'pickup T0')
pickupBtn.onClick(() => {
  vm.pickTool(0).then(() => {
    pickupBtn.good("ok", 500)
  }).catch((err) => {
    console.error(err)
    pickupBtn.bad("err", 500)
  })
})

// -------------------------------------------------------- LOADCELL 

let loadBtn = new Button(540, 100, 95, 14, 'loadcell')
let loadLp = false
loadBtn.onClick(() => {
  if (loadLp) {
    loadLp = false
    return
  }
  let lp = () => {
    if (!loadLp) {
      loadBtn.bad("cancelled", 500)
      return
    }
    vm.loadcell.getReading().then((reading) => {
      $(loadBtn.elem).text(`${reading.toFixed(3)}`)
      setTimeout(lp, 10)
    }).catch((err) => {
      console.error(err)
      loadLp = false
    })
  }
  loadLp = true
  lp()
})
*/