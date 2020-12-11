/*
virtualMachine.js

vm for Clank-LZ at Fab Class 2020

Jake Read at the Center for Bits and Atoms
(c) Massachusetts Institute of Technology 2020

This work may be reproduced, modified, distributed, performed, and
displayed for any purpose, but must acknowledge the open systems assembly protocol (OSAP) project.
Copyright is retained and must be preserved. The work is provided as is;
no warranty is provided, and users accept all liability.
*/

import { TS, PK, DK, AK, EP } from '../core/ts.js'

let motionRoute = {
    path: Uint8Array.from(TS.portf(0).concat(TS.portf(1))), // websocket, usb, dest 
    segsize: 128
}

// TODO
/*
I'll put notes here...

things like queryQueueLength, etc, all cases where we're just handling around OSAP
don't have timeouts. that means, esp. for compound calls, when machines are disconnected 
or if something else mysterious goes wrong, the buttons etc will just hang... 
maybe same as the queue transmission.

so, base level promises should all time out 

config, connection status, etc, will aspirationally be OSAP-handled 

... should be able to set currents while motion is happening, right?
... to do so, don't rewrite the currents table, use a scalar, ya doof 
*/

export default function VirtualMachine(osap) {
    // transmission state 
    let queueSpace = 1
    // default currents: CSCALE 0-8
    let motionCurrents = { X: 0.5, Y: 0.5, Z: 0.8 }
    let homeCurrents = { X: 0.2, Y: 0.2, Z: 0.2 }

    /*
    // offset, should be the vector *from* our virtual position 
    // *to* machine's internal position 
    let currentOffset = {X: 0.0, Y: 0.0, Z: 0.0 }
    */

    // receive handler 
    osap.handleAppPackets = (pck, ptr, vp, p) => {
        ptr++ // walk 
        switch (pck[ptr]) {
            case AK.GOTOPOS:
                //console.warn('got return', pck, ptr, vp, p)
                let ok = TS.read('boolean', pck, ptr + 1, true)
                //console.log('ok', ok)
                if (ok) {
                    queueSpace = 1
                } else {
                    queueSpace = 0
                }
                break;
            case AK.SETPOS:
                // ... should be OK return from set, or error msg
                if (setPositionCallback) {
                    if (pck[ptr + 1] == AK.OK) {
                        setPositionCallback(true)
                    } else {
                        if (pck[ptr + 1] == AK.ERR) {
                            let msg = TS.read('string', pck, ptr + 2, true).value
                            setPositionCallback(false, msg)
                        }
                    }
                }
                break;
            case AK.SETWAITTIME:
                if (setWaitTimeCallback) setWaitTimeCallback()
                break;
            case AK.SETCURRENT:
                // ... should be OK return from set, or error msg 
                if (setCurrentsCallback) setCurrentsCallback()
                break;
            case AK.SETRPM:
                // ... should be OK return from set, or error msg 
                if (setRPMCallback) setRPMCallback()
                break;
            case AK.SET_TC:
                if (setToolHoldTorqueCallback) setToolHoldTorqueCallback()
                break;
            case AK.RUNCALIB:
                if (runCalibCallback) runCalibCallback()
                break;
            case AK.QUERYMOVING:
                // should be true / false moving, or error 
                let state = TS.read('boolean', pck, ptr + 1, true)
                if (queryMotionStatusCallback) {
                    queryMotionStatusCallback(state)
                }
                break;
            case AK.QUERYPOS:
                let X = TS.read('float32', pck, ptr + 1, true)
                let Y = TS.read('float32', pck, ptr + 5, true)
                let Z = TS.read('float32', pck, ptr + 9, true)
                if (positionQueryCallback) {
                    positionQueryCallback({ X: X, Y: Y, Z: Z })
                }
                break;
            case AK.QUERYQUEUELEN:
                let len = TS.read('uint8', pck, ptr + 1, true)
                if (queryQueueLengthCallback) {
                    queryQueueLengthCallback(len)
                }
                break;
            default:
                console.error('recv packet w/ no app switch')
                console.error(ptr, pck)
                break;
        }
        // always clear this 
        vp.rxbuffer.splice(p, 1)
    }

    // move like: { position: {X: num, Y: num, Z: num}, rate: num }
    this.addMoveToQueue = (move) => {
        // add offset 
        /*
        move.position.X += currentOffset.X 
        move.position.Y += currentOffset.Y 
        move.position.Z += currentOffset.Z 
        */
        let wptr = 0
        let datagram = new Uint8Array(64)
        datagram[wptr++] = DK.APP
        datagram[wptr++] = AK.GOTOPOS
        // write posns 
        wptr += TS.write('float32', move.position.X, datagram, wptr, true)
        wptr += TS.write('float32', move.position.Y, datagram, wptr, true)
        wptr += TS.write('float32', move.position.Z, datagram, wptr, true)
        // write rate 
        wptr += TS.write('float32', move.rate, datagram, wptr, true)
        // write the gram 
        datagram = Uint8Array.from(datagram.subarray(0, wptr))
        // now transmission, 
        return new Promise((resolve, reject) => {
            // lol, pardon the completely asinine implementation of this thing 
            let check = () => {
                if (queueSpace > 0) {
                    queueSpace--
                    osap.send(motionRoute, datagram).then(() => {
                        resolve()
                    }).catch((err) => {
                        reject(err)
                    })
                } else {
                    console.log('-')
                    setTimeout(check, 0)
                }
            }
            check()
        })
    }

    // set position { X: num, Y: num, Z: num }
    let setPositionCallback = null
    this.setPosition = (pos) => {
        return new Promise((resolve, reject) => {
            this.queryQueueLength().then((len) => {
                if (len > 0) {
                    reject('wait for clear queue to set position')
                } else {
                    return this.queryMotionStatus()
                }
            }).then((state) => {
                if (state) {
                    reject('wait for motion to stop before setting position')
                } else {
                    /*
                    this.queryPosition().then((machinePos) => {
                        currentOffset.X = machinePos.X - pos.X
                        currentOffset.Y = machinePos.Y - pos.Y  
                        currentOffset.Z = machinePos.Z - pos.Z 
                        console.log('new offset', currentOffset)
                        resolve()
                    }).catch((err) => {
                        reject(err)
                    })
                    */
                    let wptr = 0
                    let datagram = new Uint8Array(64)
                    datagram[wptr++] = DK.APP
                    datagram[wptr++] = AK.SETPOS
                    console.log('to set', pos.X)
                    wptr += TS.write('float32', pos.X, datagram, wptr, true)
                    wptr += TS.write('float32', pos.Y, datagram, wptr, true)
                    wptr += TS.write('float32', pos.Z, datagram, wptr, true)
                    datagram = Uint8Array.from(datagram.subarray(0, wptr))
                    setPositionCallback = null
                    osap.send(motionRoute, datagram).then(() => {
                        setPositionCallback = (ok, err) => {
                            if (err || !ok) {
                                reject(`embedded err on setpos: ${err}`)
                            } else {
                                resolve()
                            }
                            setPositionCallback = null
                        }
                    }).catch((err) => { reject(err) })
                }
            })
        })
    }

    // query positions 
    let positionQueryCallback = null
    this.queryPosition = () => {
        let wptr = 0
        let datagram = new Uint8Array(64)
        datagram[wptr++] = DK.APP
        datagram[wptr++] = AK.QUERYPOS
        // write the gram 
        datagram = Uint8Array.from(datagram.subarray(0, wptr))
        // clear last handler 
        positionQueryCallback = null
        // tx 
        return new Promise((resolve, reject) => {
            osap.send(motionRoute, datagram).then(() => {
                // clean on tx, need to await reply still 
                positionQueryCallback = (pos) => {
                    // console.log('resolve pos', pos)
                    resolve(pos)
                    positionQueryCallback = null
                }
            }).catch((err) => { reject(err) })
        })
    }

    let setWaitTimeCallback = null
    this.setWaitTime = (ms) => {
        return new Promise((resolve, reject) => {
            let wptr = 0
            let datagram = new Uint8Array(64)
            datagram[wptr++] = DK.APP
            datagram[wptr++] = AK.SETWAITTIME
            wptr += TS.write('uint32', ms, datagram, wptr, true)
            datagram = Uint8Array.from(datagram.subarray(0, wptr))
            setWaitTimeCallback = null
            osap.send(motionRoute, datagram).then(() => {
                setWaitTimeCallback = () => {
                    resolve()
                }
            }).catch((err) => {
                reject(err)
            })
        })
    }

    // query queue length 
    let queryQueueLengthCallback = null
    this.queryQueueLength = () => {
        return new Promise((resolve, reject) => {
            let wptr = 0
            let datagram = new Uint8Array(64)
            datagram[wptr++] = DK.APP
            datagram[wptr++] = AK.QUERYQUEUELEN
            datagram = Uint8Array.from(datagram.subarray(0, wptr))
            queryQueueLengthCallback = null
            osap.send(motionRoute, datagram).then(() => {
                queryQueueLengthCallback = (len) => {
                    resolve(len)
                    queryQueueLengthCallback = null
                }
            }).catch((err) => { reject(err) })
        })
    }

    // query motion status 
    let queryMotionStatusCallback = null
    this.queryMotionStatus = () => {
        return new Promise((resolve, reject) => {
            let wptr = 0
            let datagram = new Uint8Array(64)
            datagram[wptr++] = DK.APP
            datagram[wptr++] = AK.QUERYMOVING
            datagram = Uint8Array.from(datagram.subarray(0, wptr))
            queryMotionStatusCallback = null
            osap.send(motionRoute, datagram).then(() => {
                queryMotionStatusCallback = (bool) => {
                    resolve(bool)
                    queryMotionStatusCallback = null
                }
            }).catch((err) => { reject(err) })
        })
    }

    // await no motion 
    this.awaitMotionEnd = () => {
        return new Promise((resolve, reject) => {
            let check = () => {
                this.queryQueueLength().then((len) => { // queue must be zero, 
                    if (len > 0) {
                        setTimeout(check, 50)
                        return
                    } else {
                        this.queryMotionStatus().then((state) => { // and motion must be over 
                            if (state) {
                                setTimeout(check, 50)
                                return
                            } else {
                                resolve()
                            }
                        }).catch((err) => {
                            reject(err)
                        })
                    }
                }).catch((err) => { reject(err) })
            }
            check()
        })
    }

    // set currents 
    // like {X: int 0-8, Y: int 0-8, Z: int 0-8}
    let setCurrentsCallback = null
    this.setCurrents = (currents) => {
        return new Promise((resolve, reject) => {
            resolve()
            return // hotfix to rm b-channel bug 
            this.awaitMotionEnd().then(() => {
                let wptr = 0
                let datagram = new Uint8Array(64)
                datagram[wptr++] = DK.APP
                datagram[wptr++] = AK.SETCURRENT
                wptr += TS.write('float32', currents.X, datagram, wptr, true)
                wptr += TS.write('float32', currents.Y, datagram, wptr, true)
                wptr += TS.write('float32', currents.Z, datagram, wptr, true)
                datagram = Uint8Array.from(datagram.subarray(0, wptr))
                setCurrentsCallback = null
                osap.send(motionRoute, datagram).then(() => {
                    setCurrentsCallback = () => { resolve() }
                }).catch((err) => {
                    reject(err)
                })
            }).catch((err) => {
                reject(err)
            })
        })
    }

    // set RPM 
    let setRPMCallback = null
    this.setRPM = (rpm) => {
        return new Promise((resolve, reject) => {
            // 0.2 -> 6300
            // 0.3 -> 12000
            // 0.4 -> 18000 
            // 0.5 -> 23000 
            // more? stop 
            // do map, RPM -> PWM 
            let pwm = 0
            if (rpm < 6300) {
                pwm = 0;
            } else if (rpm >= 6300 && rpm < 12000) {
                pwm = 0.2 + (rpm - 6300) * (0.1 / (12000 - 6300))
            } else if (rpm >= 12000 && rpm < 18000) {
                pwm = 0.3 + (rpm - 12000) * (0.1 / (18000 - 12000))
            } else if (rpm >= 18000 && rpm < 23000) {
                pwm = 0.4 + (rpm - 18000) * (0.1 / (23000 - 18000))
            } else {
                pwm = 0.5
            }
            let wptr = 0
            let datagram = new Uint8Array(64)
            datagram[wptr++] = DK.APP
            datagram[wptr++] = AK.SETRPM
            wptr += TS.write('float32', pwm, datagram, wptr, true)
            datagram = Uint8Array.from(datagram.subarray(0, wptr))
            setRPMCallback = null
            osap.send(motionRoute, datagram).then(() => {
                setRPMCallback = () => { resolve() }
            }).catch((err) => {
                reject(err)
            })
        })
    }

    // grip / release tool 
    this.gripTool = () => {
        return new Promise((resolve, reject) => {
            this.setToolHoldTorque(0.4).then(() => {
                setTimeout(() => {
                    this.setToolHoldTorque(0.2).then(() => {
                        resolve()
                    }).catch((err) => { reject(err) })
                }, 1000)
            }).catch((err) => { reject(err) })     
        })
    }

    this.releaseTool = () => {
        return new Promise((resolve, reject) => {
            this.setToolHoldTorque(-0.6).then(() => {
                setTimeout(() => {
                    this.setToolHoldTorque(-0.1).then(() => {
                        resolve()
                    }).catch((err) => { reject(err) })
                }, 1000)
            }).catch((err) => { reject(err) })     
        })
    }

    this.unlockTool = () => {
        return this.setToolHoldTorque(0.0)
    }

    let setToolHoldTorqueCallback = null
    this.setToolHoldTorque = (effort) => {
        let wptr = 0
        let datagram = new Uint8Array(64)
        datagram[wptr++] = DK.APP
        datagram[wptr++] = AK.SET_TC
        wptr += TS.write("float32", effort, datagram, wptr, true)
        datagram = Uint8Array.from(datagram.subarray(0, wptr))
        return new Promise((resolve, reject) => {
            setToolHoldTorqueCallback = null
            osap.send(motionRoute, datagram).then(() => {
                setToolHoldTorqueCallback = () => {
                    resolve()
                    setToolHoldTorqueCallback = null
                }
            }).catch((err) => { reject(err) })
        })
    }
    
    // pickup tool at (x, y)
    this.pickupTool = async (x, y) => {
        try {
            let currentPos = await this.queryPosition()
            console.log(currentPos)
            let readyPos = {
                X: x,
                Y: y + 100,
                Z: currentPos.Z
            } 
            let setPos = {
                X: x,
                Y: y,
                Z: currentPos.Z
            }
            console.log(readyPos)
            console.log(setPos)
            await this.releaseTool()
            await this.addMoveToQueue({ position: readyPos, rate: 60 })
            await this.addMoveToQueue({ position: setPos, rate: 15 })
            await this.awaitMotionEnd()
            await this.gripTool()
            await this.addMoveToQueue({ position: readyPos, rate: 30})
            await this.addMoveToQueue({ position: {
                X: 100,
                Y: 200, 
                Z: currentPos.Z 
            }, rate: 60})
        } catch (err) {
            throw new Error(err)
        }
    }

    this.dropTool = async (x, y) => {
        try {
            let currentPos = await this.queryPosition()
            console.log(currentPos)
            let readyPos = {
                X: x,
                Y: y + 100,
                Z: currentPos.Z
            } 
            let setPos = {
                X: x,
                Y: y,
                Z: currentPos.Z
            }
            console.log(readyPos)
            console.log(setPos)
            await this.addMoveToQueue({ position: readyPos, rate: 60 })
            await this.addMoveToQueue({ position: setPos, rate: 30 })
            await this.awaitMotionEnd()
            await this.releaseTool()
            await this.addMoveToQueue({ position: readyPos, rate: 15})
            await this.addMoveToQueue({ position: {
                X: 100,
                Y: 200, 
                Z: currentPos.Z 
            }, rate: 60})
        } catch (err) {
            throw new Error(err)
        }
    }

    let runCalibCallback = null
    this.runCalibration = () => {
        let wptr = 0
        let datagram = new Uint8Array(64)
        datagram[wptr++] = DK.APP
        datagram[wptr++] = AK.RUNCALIB
        datagram = Uint8Array.from(datagram.subarray(0, wptr))
        return new Promise((resolve, reject) => {
            runCalibCallback = null
            osap.send(motionRoute, datagram).then(() => {
                runCalibCallback = () => {
                    resolve()
                    runCalibCallback = null
                }
            }).catch((err) => { reject(err) })
        })
    }

    // home routine 
    let posBeforeHome = { X: 0, Y: 0, Z: 0 }
    this.home = () => {
        return new Promise((resolve, reject) => {
            this.awaitMotionEnd().then(() => {
                this.setCurrents(homeCurrents).then(() => { // turn currents down 
                    return this.queryPosition()
                }).then((pos) => {  // then move z up, slowly, to stall 
                    posBeforeHome = pos
                    console.warn('home z...')
                    return this.addMoveToQueue({
                        position: {
                            X: posBeforeHome.X,
                            Y: posBeforeHome.Y,
                            Z: posBeforeHome.Z + 10,
                        },
                        rate: 5 // slow, mm/s 
                    })
                }).then(() => { // then move xy to zero, slowly, to stall 
                    console.warn('home xy...')
                    return this.addMoveToQueue({
                        position: {
                            X: posBeforeHome.X - 160,
                            Y: posBeforeHome.Y - 160,
                            Z: posBeforeHome.Z + 100,
                        },
                        rate: 5
                    })
                }).then(() => { // now await motion end 
                    console.warn('await motion end...')
                    return this.awaitMotionEnd()
                    // move should be added now, but need to await stop 
                    // and then need to set currents back to motion scale 
                }).then(() => { // should be homed now, set currents
                    console.warn('reset currents')
                    return this.setCurrents(motionCurrents)
                }).then(() => {
                    return this.setPosition({ X: 0, Y: 0, Z: 0 })
                }).then(() => { // finally! 
                    resolve()
                }).catch((err) => {
                    reject(err)
                })
            }).catch((err) => reject(err))
        })
    }
}