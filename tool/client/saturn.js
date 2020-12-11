/*
saturn.js

js acceleration controller

Jake Read at the Center for Bits and Atoms
(c) Massachusetts Institute of Technology 2020

This work may be reproduced, modified, distributed, performed, and
displayed for any purpose, but must acknowledge the open systems assembly protocol (OSAP) project.
Copyright is retained and must be preserved. The work is provided as is;
no warranty is provided, and users accept all liability.
*/

'use strict'

import {
	vDist,
	vSum,
	vLen,
	vUnitBetween,
	vScalar,
	deg
} from './utes/smallvectors.js'
import { Input, Output } from '../core/modules.js'

// should do input is 

export default function Saturn() {
	// move settings 
	let minSpeed = 1.0      // units / s
	let cruise = 2         // units / s
	let accel = 500           // units / s / s
	let deviation = 0.5     // units of junction deviation: bigger for more instant accel at corners 
	let period = 0.050      // minimum move time (WARN: this probably conflicts with minspeed, no?) 
	console.warn(`SATURN minimum segment size is ${minSpeed * period}`)

	// our state, 
	let positions = [[0, 0]]
	let speed = minSpeed
	let streaming = false
	let outputTimer = null 
	let LOGRUNTIME = false
	let LOGTIME = false
	let LOGSMALLNESS = false 

	this.rampOut = new Output()

	// need code here to await transmission as well as service interrupts... 
	console.warn("THIS IS TROUBLE")
	this.checkStream = async () => {
		// if are not scheduled to ship anything, and have new targets 
		if(!outputTimer && positions.length > 1){
			// check if clear?
			if(this.rampOut.io()){
				// set timer to check, 
				setTimeout(this.checkStream, 0)
			} else {
				// setup next: draw ramps given current positions in buffer (do the planning)
				let ramps = runSaturn(positions, speed)
				if(ramps.length < 1) return 
				// ship that, 
				try {
					await this.rampOut.send(ramps[0])			
				} catch (err) {
					console.error(err)
				}
				console.warn('saturn out')
				// set internal state as if this ramp is assumed complete 
				speed = ramps[0].vf 
				// position is a bit more complicated, some ramps are mid-pos 
				let dtp = vDist(ramps[0].pf, positions[1])
				if(dtp < 0.001){
					positions.shift() // cleared last, shift out 
				} else {
					positions[0] = ramps[0].pf // current pos is mid-pos / end of ramp 
				}
				// calculate and set next delay 
				let delay = Math.max(0, ramps[0].t * 1000) // time in s, do for ms 
				// for debug, 
				delay = 0 
				//console.log(`delay ${delay}`)
				outputTimer = setTimeout(() => {
					outputTimer = null 
					this.checkStream()
				}, delay)
				// check input stream, 
				if(this.onMoveComplete) this.onMoveComplete()
			}
		}
	}

	this.moveIn = new Input()
	this.moveIn.addListener((move) => {
		return new Promise((resolve, reject) => {	
				if(positions.length >= 64){
				//console.warn('wait')
				// wait case 
				this.onMoveComplete = () => {
					if(positions.length < 64){
						//console.warn('load')
						this.addPos([move.position.X, move.position.Y, move.position.Z])
						this.onMoveComplete = null // remove the listener 
						resolve()
					}
				}
			} else {
				this.addPos([move.position.X, move.position.Y, move.position.Z])
				resolve()
			}
		})
	})
	this.addPos = (pos) => {
		// want to check, and wrap in try / catch ... 'pos' input is shaky 
		try {
			let segsize = vDist(pos, positions[positions.length - 1])
			if (segsize < (minSpeed * period)) {
				//console.warn(`micromove ${segsize.toFixed(4)}`)
			}
			positions.push(pos)
			this.checkStream()
		} catch (err) {
			console.warn('err at saturn input', err)
		}
	}

	this.reset = () => {
		positions = [[0, 0]]
		speed = minSpeed
	}

	// ---------------------------------------------------- Period Pass 
	let periodPass = (posns, speeds, debug) => {
		for (let i = posns.length - 2; i > 0; i--) {
			// distance to make,
			let d = vDist(posns[i], posns[i + 1])
			// the *fastest* we could go if we go flat out, in one period, is
			let v = d / period
			// set self,
			speeds[i] = v
			// traceback:
			if (speeds[i + 1] > speeds[i]) {
				speeds[i + 1] = v
			}
		}
	}

	// ---------------------------------------------------- Junction Deviation 
	let jd = (posns, speeds, debug) => {
		//console.log('posns', posns)
		let calcJunctionSpeed = (p0, p1, p2, debug) => {
			// junction speed at p1, arrival from p0 exit to p2
			let v0 = math.subtract(p1, p0)
			let v1 = math.subtract(p2, p1)
			if (debug) console.log('for\n', v0, v1)
			let dotprod = math.dot(v0, v1) / (vLen(v0) * vLen(v1))
			if (debug) console.log('dotprod', dotprod)
			// block for floating pt errors that drive this term past +/- 1
			if (dotprod < 1) dotprod = -1
			if (dotprod > 1) dotprod = 1
			let omega = Math.PI - Math.acos(dotprod)
			if (debug) console.log('angle between', deg(omega))
			let r = deviation / (1 / Math.cos(Math.PI / 2 - omega / 2) - 1)
			if (debug) console.log('rad', r)
			let v = Math.sqrt(accel * r)
			if (debug) console.log('permissible', v)
			return v
		}
		// the ops,
		for (let m = 0; m < posns.length; m++) {
			if (m === 0) continue // noop for start: this is our current speed, should already be in speeds arr
			if (m === posns.length - 1) continue // noop for last move, nothing to junction into, exit should be minspeed
			let jd = calcJunctionSpeed(posns[m - 1], posns[m], posns[m + 1])
			if (Number.isNaN(jd)) {
				console.warn(`after jd, NaN for move at ${m}`, posns[m - 1], posns[m], posns[m + 1])
				// run again w/ debug
				calcJunctionSpeed(posns[m - 1], posns[m], posns[m + 1], true)
			}
			if (jd < speeds[m]) {
				speeds[m] = jd
			}
		}
		// walk for minspeeds
		for (let s in speeds) {
			if (speeds[s] < minSpeed) speeds[s] = minSpeed
			if (speeds[s] > cruise) speeds[s] = cruise
		}
		// that's it for us
		return speeds
	}

	// ---------------------------------------------------- Reverse Pass 
	let reversePass = (posns, speeds, debug) => {
		// link, walking back from last
		// this makes sure we can completely decelerate, through moves, to the last point at zero
		for (let i = posns.length - 2; i > 0; i--) {
			if (debug) console.log(`reverse pass for ${i}\n`, posns[i], posns[i + 1])
			if (debug) console.log(`current entrance to calculate is`, speeds[i])
			if (debug) console.log(`the constraining exit is`, speeds[i + 1])
			// to calcluate the maximum entrance, given our exit, with pure acceleration:
			let d = vLen(math.subtract(posns[i + 1], posns[i]))
			let maxEntranceByAccel = Math.sqrt(Math.pow(speeds[i + 1], 2) + 2 * accel * d)
			let max = Math.max(minSpeed, Math.min(speeds[i], maxEntranceByAccel))
			// just for logging
			let temp = speeds[i]
			// stay safe w/ current state at zero
			if (i === 0) {
				// only the future can be modified
			} else {
				speeds[i] = max
			}
			if (debug) console.log(`entrance was ${temp}, now ${speeds[i]}`)
		}
	}

	// ---------------------------------------------------- Forward Pass
	let forwardPass = (posns, speeds, debug) => {
		// link, walk forwards: can we accel to these velocities in time?
		for (let i = 0; i < posns.length - 2; i++) {
			if (debug) console.log(`forwards pass for ${i}\n`, posns[i], posns[i + 1])
			if (debug) console.log(`current exit to calculate is`, speeds[i + 1])
			if (debug) console.log(`the constraining entrance is`, speeds[i])
			let d = vLen(math.subtract(posns[i + 1], posns[i]))
			let maxExitByAccel = Math.sqrt(Math.pow(speeds[i], 2) + 2 * accel * d)
			let max = Math.max(minSpeed, Math.min(speeds[i + 1], maxExitByAccel))
			let temp = speeds[i + 1]
			if (i === posns.length - 2) {
				// tail should always be minspeed, if not, trouble
				if (max > minSpeed) console.warn('trouble halting early')
			} else {
				speeds[i + 1] = max
			}
			if (debug) console.log(`exit was ${temp}, now ${speeds[i + 1]}`)
		}
		// link forwards, now making sure we can accel from our start speed up to the exit
		// here is assuming posns[0] is current position, for which speed is the current velocity
	}

	// ---------------------------------------------------- Check Segs are all < minTime 
	let posnsCheck = (posns, speeds) => {
		for (let i = 0; i < posns.length - 1; i++) {
			let d = vDist(posns[i], posns[i + 1])
			let vi = speeds[i]
			let vf = speeds[i + 1]
			let t = 2 * d / (vi + vf)
			if (false) console.log(`ap, ${t.toFixed(3)}`)
			if(LOGSMALLNESS) if (t < (period - 0.001)) console.warn('small link in posns check')
		}
	}

	// ---------------------------------------------------- Seg -> Ramps 
	let writeSeg = (ramps, vi, vf, pi, pf) => {
		let d = vDist(pi, pf)
		ramps.push({
			vi: vi,
			vf: vf,
			t: 2 * d / (vi + vf),
			pi: pi,
			pf: pf
		})
		// to trace errors, turn these on, to see which seg-writing moves might be missing steps 
		//console.error('pi, pf')
		//console.log(pi, pf)
		// check gap 
		if (ramps.length > 2) {
			let sep = vDist(ramps[ramps.length - 2].pf, ramps[ramps.length - 1].pi)
			if (sep > 0.001) throw new Error('HERE')
		}
	}

	// ---------------------------------------------------- Triangle -> Seg 
	let writeTriangle = (ramps, vi, vf, pi, pf) => {
		let d = vDist(pi, pf)
		// not sure when I wrote this eqn, seems to work tho
		let vPeak = Math.sqrt(((2 * accel * d + Math.pow(vi, 2) + Math.pow(vf, 2)) / 2))
		let acDist = (Math.pow(vPeak, 2) - Math.pow(vi, 2)) / (2 * accel)
		let pInter = math.add(pi, vScalar(vUnitBetween(pi, pf), acDist))
		// finally, we have to check here if either / or side is too small, then default to smallticks
		let tSeg1 = (vPeak - vi) / accel
		let tSeg2 = (vPeak - vf) / accel
		if (tSeg1 < period || tSeg2 < period) {
			// bail hard, write one seg only
			writeSeg(ramps, vi, vf, pi, pf)
		} else {
			// write two segs,
			writeSeg(ramps, vi, vPeak, pi, pInter)
			writeSeg(ramps, vPeak, vf, pInter, pf)
		}
	}

	// ---------------------------------------------------- Ramp Pass 
	// turn posns, speeds into segments, writing accelerations between
	let rampPass = (posns, speeds, debug) => {
		let rmps = []
		for (let i = 0; i < posns.length - 1; i++) {
			let numRampsBefore = rmps.length
			if (debug) console.log(`ramp pass for ${i}`)
			let pi = posns[i]
			let pf = posns[i + 1]
			let vi = speeds[i]
			let vf = speeds[i + 1]
			let d = vDist(pi, pf)
			let maxEntry = Math.sqrt(Math.pow(speeds[i + 1], 2) + 2 * accel * d)
			let maxExit = Math.sqrt(Math.pow(speeds[i], 2) + 2 * accel * d)
			if (debug) console.log(`entrance speed is ${vi}`)
			if (debug) console.log(`exit speed is ${vf}`)
			if (debug) console.log(`d is ${d}, maxEntry ${maxEntry}, maxExit ${maxExit}`)
			// big switch
			if (maxExit <= vf) {
				// the all-up and all-down segments should always be clear:
				// since we already swept for these cases in the revpass
				if (debug) console.log(`/`)
				writeSeg(rmps, vi, vf, pi, pf)
			} else if (maxEntry <= vi) {
				if (debug) console.log('\\')
				writeSeg(rmps, vi, vf, pi, pf)
			} else if (vi === cruise && vf === cruise) {
				// similarely, since we're not segmenting cruise any farther, it should also be OK
				if (debug) console.log('--')
				writeSeg(rmps, vi, vf, pi, p)
			} else if (vi === cruise) {
				if (debug) console.log('--\\')
				let dcDist = (Math.pow(vi, 2) - Math.pow(vf, 2)) / (2 * accel) // distance to deccelerate
				let pInter = math.add(pf, vScalar(vUnitBetween(pf, pi), dcDist))
				// now, we need to tune accel / cruise phases so that neither t is < 1 period
				let tSeg1 = (d - dcDist) / vi
				let tSeg2 = (vi - vf) / accel
				if (tSeg1 < period || tSeg2 < period) {
					// small segs, just write as one downtick,
					writeSeg(rmps, vi, vf, pi, pf)
				} else {
					// if these are both > one period, we can write 'em
					writeSeg(rmps, vi, vi, pi, pInter)
					writeSeg(rmps, vi, vf, pInter, pf)
				}
			} else if (vf === cruise) {
				if (debug) console.log('/--')
				let acDist = (Math.pow(cruise, 2) - Math.pow(vi, 2)) / (2 * accel)
				let pInter = math.add(pi, vScalar(vUnitBetween(pi, pf), acDist))
				// I feel the same about this as I did above
				let tSeg1 = (cruise - vi) / accel
				let tSeg2 = (d - acDist) / cruise
				if (tSeg1 < period || tSeg2 < period) {
					writeSeg(rmps, vi, vf, pi, pf)
				} else {
					writeSeg(rmps, vi, vf, pi, pInter)
					writeSeg(rmps, vf, vf, pInter, pf)
				}
			} else {
				// here we will handle triangles '/\' and 'full trapezoids' '/--\'
				let dcDist = (Math.pow(cruise, 2) - Math.pow(vf, 2)) / (2 * accel)
				let acDist = (Math.pow(cruise, 2) - Math.pow(vi, 2)) / (2 * accel)
				if (dcDist + dcDist >= d) {
					if (debug) console.log('/\\')
					writeTriangle(rmps, vi, vf, pi, pf)
				} else { // BEGIN TRAP SELECTIONS
					if (debug) console.log('/--\\')
					let pa = math.add(pi, vScalar(vUnitBetween(pi, pf), acDist))
					let pb = math.add(pf, vScalar(vUnitBetween(pf, pi), dcDist))
					// ok,
					let tSeg1 = (cruise - vi) / accel
					let tSeg2 = (d - acDist - dcDist) / cruise
					let tSeg3 = (cruise - vf) / accel
					// here we go
					if (tSeg2 < period) {
						// for this case, contencating into a triangle is fine... it will be within ~ 50ms of extra accel time: not much
						if (debug) console.log('/\\')
						writeTriangle(rmps, vi, vf, pi, pf)
					} else if (tSeg1 < period && tSeg3 < period) {
						// contencate into one ramp
						writeSeg(rmps, vi, vf, pi, pf)
					} else if (tSeg1 < period) {
						// first segment smaller: second larger, third larger
						// contencate first, second into one, then write last
						writeSeg(rmps, vi, cruise, pi, pb)
						writeSeg(rmps, cruise, vf, pb, pf)
					} else if (tSeg3 < period) {
						// last segment smaller: second larger, first larger
						// write first, then contencate second, third into one
						writeSeg(rmps, vi, cruise, pi, pa)
						writeSeg(rmps, cruise, vf, pa, pf)
					} else {
						// forgot the genuine full cruiser, here it is
						writeSeg(rmps, vi, cruise, pi, pa)
						writeSeg(rmps, cruise, cruise, pa, pb)
						writeSeg(rmps, cruise, vf, pb, pf)
					}
				} // end TRAP SELECTIONS
			} // end BIGSWITCH
			if (rmps.length === numRampsBefore) console.warn('zero ramps written for', pi, pf, vi, vf)
		} // end for-over-posns
		return rmps
	}

	// ---------------------------------------------------- Check Ramps are all in spec
	let rampCheck = (ramps) => {
		for (let i = 0; i < ramps.length; i++) {
			let r = ramps[i]
			let d = vDist(r.pi, r.pf)
			let t = 2 * d / (r.vi + r.vf)
			if(LOGSMALLNESS) if (t < (period - 0.001)) console.warn('troublesome ramp, small time', r)
			// more than 10% over speed is probably not cool,
			let cruiseAbsMax = cruise + 0.15 * cruise
			if (r.vi > cruiseAbsMax || r.vf > cruiseAbsMax) console.warn('troublesome ramp, high speed', r)
			// check that ramps are continuous
			if (i < ramps.length - 2) {
				let sep = vDist(r.pf, ramps[i + 1].pi)
				if (sep > 0.001) console.warn('disconnected ramp junction', r, ramps[i + 1])
			}
		}
	}

	// should return ramps for given posns, where p[0] is current pos, and speed is vi 
	let runSaturn = (posns, speed) => {
		if (LOGRUNTIME) console.log('runSaturn')
		if (LOGTIME) console.time('lookahead')
		// posns[] is global, generate speeds for 
		let speeds = new Array(posns.length)
		speeds[0] = speed // begin at current speed, 
		speeds[speeds.length - 1] = minSpeed // end at target min velocity (stopped)
		// first, set all speeds such that moves can be made within single periods 
		periodPass(posns, speeds)
		// juction deviation calculates maximum allowable instantaneous acceleration through corners 
		jd(posns, speeds)
		// reverse pass, links through moves such that we can decelerate successfully to the end 
		reversePass(posns, speeds)
		// forward pass accelerates through, 
		forwardPass(posns, speeds)
		// check speeds are all sound after these passes (for mintime / period) 
		posnsCheck(posns, speeds)
		// re-generate the ramps, 
		let ramps = rampPass(posns, speeds, false)
		// check ramps are all sequential 
		rampCheck(ramps)
		if (LOGTIME) console.timeLog('lookahead')
		if (LOGTIME) console.timeEnd('lookahead')
		return ramps
	}
}