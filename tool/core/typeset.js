/*
typeset.js

Jake Read at the Center for Bits and Atoms
(c) Massachusetts Institute of Technology 2020

This work may be reproduced, modified, distributed, performed, and
displayed for any purpose, but must acknowledge the open systems assembly protocol (OSAP) project.
Copyright is retained and must be preserved. The work is provided as is;
no warranty is provided, and users accept all liability.
*/

// typeset: functional types -> bytes for js -> embedded sys
// bless up @ modern js https://developer.mozilla.org/en-US/docs/Web/JavaScript/Typed_arrays

let tsdebug = false

// oy,

const checkKey = (type, arr, start) => {
  if (arr[start] !== type.key) {
    console.log('erroneous bytes')
    console.log(arr)
    throw new Error(`mismatched key on phy read: for ${type.name}, find ${arr[start]} instead of ${type.key} ... at ${start} index`)
  }
}

const checkBoolean = (value) => {
  if (typeof value !== 'boolean')
    throw new Error('cannot cast non-boolean to bool at phy')
}

const checkNumber = (value) => {
  if (typeof value !== 'number')
    throw new Error(`cannot cast non-number into physical world "${value}", ${typeof value}`)
}

const checkString = (value) => {
  if (typeof value !== 'string')
    throw new Error(`cannot cast non-string to string at phy! "${value}", "${typeof value}"`)
}

const checkArray = (thing) => {
  if (!Array.isArray(thing))
    throw new Error('this thing is not an array!')
}

const checkUnsigned = (value, bits) => {
  if (value > Math.pow(2, bits))
    throw new Error('value out of byte bounds')
}

const checkSigned = (value, bits) => {
  let comparator = Math.pow(2, bits - 1)
  if (value > comparator || value < -comparator)
    throw new Error('value out of byte bounds')
}

const findPhy = (type) => {
  let phy = TSET.find((cand) => {
    return cand.name === type
  })
  if (phy === undefined)
    // try this... catch err elsewhere
    throw new Error(`could not find phy for datatype: ${type}`)
  return phy
}

const bounds = (value, min, max) => {
  return Math.max(min, Math.min(value, max))
}

const intBounds = (pfloat, min, max) => {
  return Math.round(bounds(pfloat, min, max))
}

// TYPES:
/*
name: string identifier, how we 'specify' what an input / output / state is
key: byte-code for the network. if this, write, and read, don't exist, link can't have one
write: serialize into bytes
read: deserialize
copy: move about within js,
 copies are 'outgoing' ... so typeA.copy.typeB(value) turns the value from
 typeA -> typeB
 the standard is typeA.copy.typeA(value), this is just a memory shuffle
 for the sake of dereferencing: we can write our own types per item
*/

// TODO: TYPES:
/*
we are still not really type-checking on calls to .put(), and should be...
there is probably a slick, clean way to do this
also: would really like to work with typedarrays where they are appropriate

.. *could* imagine some hairbrain walk through these things: if we have, i.e., conversion
from string -> number written, and from number -> uint8, we should be able to
compose a tree of these on the fly ...
*/

const TSET = [
  {
    name: 'boolean',
    key: 32,
    write: function(value) {
      checkBoolean(value)
      let rtarr = [this.key]
      if (value) {
        rtarr.push(1)
      } else {
        rtarr.push(0)
      }
      return rtarr
    },
    read: function(arr, start) {
      checkKey(this, arr, start)
      let item
      if (arr[start + 1] === 1) {
        item = true
      } else if (arr[start + 1] === 0) {
        item = false
      } else {
        throw new Error(`non std boolean byte, ${arr[start + 1]}`)
      }
      return {item: item, increment: 2}
    },
    copy: {
      boolean: function(bool) {
        return bool // direct: a basic js type, so we just pass it on
      },
      number: function(bool) { // converts boolean -> numbers
        if (bool) {
          return 1
        } else {
          return 0
        }
      },
      reference: function(bool){
        return bool
      }
    }
  }, { // booleanArray: 33,
    name: 'byte',
    key: 34,
    write: function(value) {
      checkNumber(value)
      checkUnsigned(value, 8)
      return [this.key, value]
    },
    read: function(arr, start) {
      checkKey(this, arr, start)
      return {
        item: arr[start + 1],
        increment: 2
      }
    },
    copy: {
      byte: function(byte) {
        return byte
      }
    }
  }, {
    name: 'byteArray',
    key: 35,
    write: function(value) {
      checkArray(value)
      let rtarr = writeLenBytes(value.length).concat(value)
      rtarr.unshift(this.key)
      if (tsdebug)
        console.log('byteArray sanity check:', value, 'written as:', rtarr)
      return rtarr
    },
    read: function(arr, start) {
      checkKey(this, arr, start)
      let lb = readLenBytes(arr, start + 1)
      let narr = new Array()
      for (let i = 0; i < lb.len; i++) {
        narr.push(arr[start + 1 + lb.numBytes + i])
      }
      return {
        item: narr,
        increment: lb.len + lb.numBytes + 1
      }
    },
    copy: { // copy:  into another bytearray
      byteArray: function(arr) {
        // TODO would be making bytearrays into buffers, would speed this up ...
        let ret = new Array(arr.length)
        for (let item in arr) {
          ret[item] = arr[item]
        }
        return ret
      },
      reference: function(arr){
        let ret = new Array(arr.length)
        for (let item in arr) {
          ret[item] = arr[item]
        }
        return ret
      }
    }
  }, { // char 36, string 37,
    name: 'string',
    key: 37,
    write: function(str) {
      checkString(str)
      let rtarr = new Array()
      for (let i = 0; i < str.length; i++) {
        rtarr.push(str.charCodeAt(i))
      }
      // length bytes are 7-bit 'msb for continue' numbers ...
      // the -1 because we are not counting the length of the key
      let lb = writeLenBytes(rtarr.length)
      rtarr = lb.concat(rtarr)
      rtarr.unshift(this.key)
      return rtarr
    },
    read: function(arr, start) {
      checkKey(this, arr, start)
      let lb = readLenBytes(arr, start + 1)
      //console.log('lenbytes', lb)
      let str = new String()
      for (let i = 0; i < lb.len; i++) {
        str += String.fromCharCode(arr[start + 1 + lb.numBytes + i])
      }
      return {
        item: str,
        increment: lb.len + lb.numBytes + 1
      }
    },
    copy: {
      string: function(str) {
        return str
      },
      number: function(str) {
        return parseFloat(str)
      },
      boolean: function(str){
        if(str == true){
          return true
        } else {
          return false
        }
      },
      reference: function(str){
        return str
      }
    }
  }, {
    name: 'uint8',
    key: 38,
    write: function(value) {
      checkNumber(value)
      checkUnsigned(value, 8)
      if (value > 255 || value < 0)
        throw new Error('num too large to represent with cast type, will contencate')
        // dont' need to type-buffer this,
      let rtarr = [this.key, value]
      return rtarr
    },
    read: function(arr, start) {
      // assume we're reading out of an array
      // start[] should === key
      if (arr[start] !== this.key)
        throw new Error(`mismatched key on phy read: ${arr[start]}, ${this.key}`)
      if (arr[start + 1] > 255 || arr[start + 1] < 0)
        throw new Error('whaky read-in on uint8')
      return {
        item: arr[start + 1],
        increment: 2
      }
    },
    copy: {
      uint8: function(uint8){
        // by clamping at the copy, we can reduce complexity at read and write ?
        // and improve clarity elsewhere ...
        return bounds(uint8, 0, 255) // clamp number
      },
      uint16: function(uint8){
        // because we always copy-in before copying-out (to other types)
        // we don't have to clamp here again, that's nice.
        // but would to go down to a smaller value ...
        return uint8
      },
      uint32: function(uint8){
        // this could really get exhaustive,
        return uint8
      },
      number: function(uint8){
        return uint8
      }
    }
  }, { // uint8Array 39
    name: 'uint16',
    key: 40,
    write: function(value) {
      if (typeof value !== 'number')
        throw new Error(`cannot cast non-number into physical world "${value}", ${typeof value}`)
      if (value > 65536 || value < 0)
        throw new Error('num too large to represent with cast type, will contencate')
      let tparr = new Uint16Array(1)
      tparr[0] = value
      let btarr = new Uint8Array(tparr.buffer)
      //place
      let rtarr = Array.from(btarr)
      rtarr.unshift(this.key)
      return rtarr
    },
    read: function(arr, start) {
      // assume we're reading out of an array
      // start[] should === key
      if (arr[start] !== this.key)
        throw new Error(`mismatched key on phy read: ${arr[start]}, ${this.key}`)
      let rdarr = arr.slice(start + 1, start + 3)
      let btarr = Uint8Array.from(rdarr)
      if (tsdebug)
        console.log('bytes on read of uint16 (little eadian)', btarr)
        // now make uint32 view on this ...
      let vlarr = new Uint16Array(btarr.buffer)
      if (tsdebug)
        console.log('vlarr', vlarr)
      return {item: vlarr[0], increment: 3}
    },
    copy: {
      uint16: function(uint16){
        return bounds(uint16, 0, 65535)
      },
      uint8: function(uint16){
        return bounds(uint16, 0, 255)
      },
      number: function(uint16){
        return uint16
      }
    }
  }, { // uint16 array 41
    name: 'uint32',
    key: 42,
    write: function(value) {
      if (typeof value !== 'number')
        throw new Error(`cannot cast non-number into physical world "${value}", ${typeof value}`)
      if (value > 4294967296)
        throw new Error('num too large to represent with cast type, will contencate')
      let tparr = new Uint32Array(1)
      tparr[0] = value
      let btarr = new Uint8Array(tparr.buffer)
      //place
      let rtarr = Array.from(btarr)
      rtarr.unshift(this.key)
      if (tsdebug)
        console.log("UINT32 WRITES ARR: ", rtarr, "FOR: ", value)
      return rtarr
    },
    read: function(arr, start) {
      // assume we're reading out of an array
      // start[] should === key
      if (arr[start] !== this.key) {
        console.log("erroneous bytes:", arr)
        console.log("error at byte:", start, "is", arr[start])
        console.log("expected key:", this.key)
        throw new Error(`mismatched key on phy read: ${arr[start]}, ${this.key}`)
      }
      let rdarr = arr.slice(start + 1, start + 5)
      let btarr = Uint8Array.from(rdarr)
      if (tsdebug)
        console.log('bts on read of uint32', btarr)
        // now make uint32 view on this ...
      let vlarr = new Uint32Array(btarr.buffer)
      if (tsdebug)
        console.log("UINT32 READ ARR: ", vlarr[0], "FROM: ", btarr)
      if (tsdebug)
        console.log('vlarr', vlarr)
      return {item: vlarr[0], increment: 5}
    },
    copy: {
      uint32: function(uint32){
        return bounds(uint32, 0, 4294967295)
      },
      number: function(uint32){
        return uint32
      }
    }
  }, // uint32array 43,
  /*
  uint64 44, uint64array 45,
  int8 46, int8array 47,
  int16 48, int16array 49,
  int32 50, int32array 50,
  */
  {
    name: 'int32',
    key: 50,
    write: function(value) {
      if (typeof value !== 'number')
        throw new Error(`cannot cast non-number into physical world "${value}", ${typeof value}`)
      let tparr = new Int32Array(1)
      tparr[0] = value
      let btarr = new Uint8Array(tparr.buffer)
      //place
      let rtarr = Array.from(btarr)
      rtarr.unshift(this.key)
      if (tsdebug)
        console.log("INT32 WRITES ARR: ", rtarr, "FOR: ", value)
      return rtarr
    },
    read: function(arr, start) {
      // assume we're reading out of an array
      // start[] should === key
      if (arr[start] !== this.key)
        throw new Error(`mismatched key on phy read: ${arr[start]}, ${this.key}`)
      let rdarr = arr.slice(start + 1, start + 5)
      let btarr = Uint8Array.from(rdarr)
      if (tsdebug)
        console.log('bts on read of uint32', btarr)
        // now make uint32 view on this ...
      let vlarr = new Int32Array(btarr.buffer)
      if (tsdebug)
        console.log("UINT32 READ ARR: ", vlarr[0], "FROM: ", btarr)
      if (tsdebug)
        console.log('vlarr', vlarr)
      return {item: vlarr[0], increment: 5}
    },
    copy: {
      int32: function(int32){
        return bounds(int32, -2147483647, 2147483647)
      },
      number: function(int32){
        return int32
      }
    }
  },
  /*
  int64 52, int64array 53,
  float32 54, float32array 55,
  float64 56, float64array 57 (these are === javascript 'numbers') ... how to alias ?
  */
  {
    name: 'number',
    key: 56,
    write: function(value) {
      if (typeof value !== 'number')
        throw new Error(`cannot cast non-number into physical world "${value}", ${typeof value}`)
      let tparr = new Float64Array(1)
      tparr[0] = value
      let btarr = new Uint8Array(tparr.buffer)
      // place
      let rtarr = Array.from(btarr)
      rtarr.unshift(this.key)
      return rtarr
    },
    read: function(arr, start) {
      if (arr[start] !== this.key)
        throw new Error(`mismatched key on phy read: ${arr[start]}, ${this.key}`)
      let rdarr = arr.slice(start + 1, start + 9)
      let btarr = Uint8Array.from(rdarr)
      if (tsdebug)
        console.log('bts on read of float64', btarr)
      let vlarr = new Float64Array(btarr.buffer)
      if (tsdebug)
        console.log('vlarr', vlarr)
      return {item: vlarr[0], increment: 9}
    },
    copy: {
      number: function(num){
        return num
      },
      boolean: function(num){
        if(num > 0){
          return true
        } else {
          return false
        }
      },
      uint8: function(num){
        return intBounds(num, 0, 255)
      },
      uint16: function(num){
        return intBounds(num, 0, 65535)
      },
      uint32: function(num){
        return intBounds(num, 0, 4294967295)
      },
      int32: function(num){
        return intBounds(num, -2147483647, 2147483647)
      }
    }
  },
  { // cuttlefish only, not a real pass
    name: 'reference',
    copy: {
      reference: function(ref){
        let type = typeof ref
        if(type === 'string' || type === 'number' || type === 'boolean'){
          console.error('cannot pass core types as a reference')
          return null
        } else {
          return ref
        }
      }
    }
  },
  {
    name: 'object',
    copy: {
      object: function(obj){
        return JSON.parse(JSON.stringify(obj))
      }
    }
  },
  { // cuttlefish only, so no key, read or write fn's
    // this is : https://developer.mozilla.org/en-US/docs/Web/API/ImageData
    name: 'ImageData',
    copy: {
      ImageData: function(imageData){
        return new ImageData(
          new Uint8ClampedArray(imageData.data),
          imageData.width,
          imageData.height
        ) //
      },
      reference: function(imageData){
        return imageData
      }
    }
  },
  {
    name: 'Float32Array',
    copy: {
      Float32Array: function(float32Array) {
        return float32Array.slice();
      }
    }
  },
  {
    name: 'array',
    copy: {
      array: (arr) => [...arr],
      reference: (arr) => {
        return arr
      }
    }
  },
  {
    name: 'MDmseg',
    key: 88,
    write: function(ms) {
      // ok, bless up, we have:
      /*
      p0: 3-arr
      p1: 3-arr
      t: num
      v0: num
      a: num
      // for simplicity, we should write one typedarray
      */
      let f32arr = Float32Array.from([
        ms.p0[0], ms.p0[1], ms.p0[2],
        ms.p1[0], ms.p1[1], ms.p1[2],
        ms.t, ms.v0, ms.a]
      )
      // ok,
      let btarr = new Uint8Array(f32arr.buffer)
      let rtarr = Array.from(btarr)
      rtarr.unshift(this.key)
      return rtarr
    },
    read: function(arr, start) {
      /*
      if (arr[start] !== this.key)
        throw new Error(`mismatched key on phy read: ${arr[start]}, ${this.key}`)
      let rdarr = arr.slice(start + 1, start + 9)
      let btarr = Uint8Array.from(rdarr)
      if (tsdebug)
        console.log('bts on read of float64', btarr)
      let vlarr = new Float64Array(btarr.buffer)
      if (tsdebug)
        console.log('vlarr', vlarr)
      return {item: vlarr[0], increment: 9}
      */
    },
    copy: {
      MDmseg: (mdmseg) => {
        return {
          p0: mdmseg.p0,
          p1: mdmseg.p1,
          t: mdmseg.t,
          v0: mdmseg.v0,
          a: mdmseg.a
        }
      },
      reference: (mdmseg) => {
        return mdmseg
      }
    }
  }
  // etc
] // end TSET

let intTypes = [
  'uint8',
  'uint16',
  'uint32',
  'uint64',
  'int8',
  'int16',
  'int32',
  'int64'
]

let floatTypes = ['number']

const isIntType = (type) => {
  for (let t of intTypes) {
    if (type == t)
      return true
  }
  return false
}

const isFloatType = (type) => {
  for (let t of floatTypes) {
    if (type == t)
      return true
  }
  return false
}

const isNumType = (type) => {
  if (isIntType(type))
    return true
  if (isFloatType(type))
    return true
  return false
}

const writeLenBytes = (len) => {
  // return array of len bytes for this number
  let bts = new Array()
  if (len > 65536) {
    throw new Error('cannot write length bytes for len > 2^16')
  } else {
    // this is little eadian ... right ?
    bts.push(len & 255);
    bts.push((len >> 8) & 255);
  }
  // here to check,
  //if(len > 255){
  //  console.log(`LEN > 255: writes len bytes `, bts[0], bts[1], 'for', len)
  //}
  return bts
}

const readLenBytes = (arr, start) => {
  // need 2 know how many to increment as well,
  let len = (arr[start + 1] << 8) | arr[start]
  // still interested in this,
  //if(len > 255){
  //  console.log(`LEN > 255: reads len bytes `, arr[start], arr[start+1], 'for len', len)
  //}
  return {len: len, numBytes: 2}
}

// heavy mixin of functional programming
const MSGS = {
  writeTo: function(bytes, thing, type, debug) {
    let phy = findPhy(type)
    // try some js type conversion,
    // course correction here: sometimes states that are numbers are saved as strings (json)
    // we can unf- this here,
    if (typeof thing === 'string' && isNumType(type)) {
      //console.warn('patching num')
      if (isIntType(type)) {
        thing = parseInt(thing)
      } else {
        thing = parseFloat(thing)
      }
      //console.log('new num val', thing)
    } else if (typeof thing === 'string' && type === 'boolean') {
      // ha! use (?) for 'truthiness'
      //console.warn('patching bool')
      if (thing == 'true') {
        thing = true
      } else {
        thing = false
      }
      //console.log('new bool val', thing)
    }
    let block = phy.write(thing)
    if (debug)
      console.log(`writing for type ${type} and thing '${thing}' the following block of bytes`, block)
      // write-in to msg like this
    // this *must be* slow AF, pls correct
    block.forEach((byte) => {
      bytes.push(byte)
    })
  },
  readFrom: function(bytes, place, type) {
    let phy = findPhy(type)
    // check that type exists at place, rip it oot and return it
    return phy.read(bytes, place)
  },
  readListFrom: function(bytes, place, type) {
    // using this where I expect a lit of values, i.e. the addLink(str,str,str,str) arguments,
    // plucks thru, continuing to pull values as long as the next in the serialized list is of
    // the right type
    let phy = findPhy(type)
    // the list of items,
    let list = new Array()
    while (place < bytes.length) {
      let res = phy.read(bytes, place)
      list.push(res.item)
      place += res.increment
      if (bytes[place] !== phy.key)
        break
        // this could throw us into infinite loops, so
      if (res.increment < 1)
        throw new Error('dangerous increment while reading list')
    }
    if (list.length < 1)
      throw new Error('reading list, found no items...')
    if (tsdebug)
      console.log('read list as', list)
    return list
  }
}

// typically: call, response expected
// manager keys
const MK = {
  // bzzt
  ERR: 254, // (str) message
  // heartbeats, wakeup
  HELLO: 231, // (eom)
  // request a top-level description
  QUERY: 251, // (eom)
  BRIEF: 250, // (str) name of interpreter, # hunks, # links (and then begin firing list back)
  // please show what is available
  REQLISTAVAIL: 249, // (eom)
  LISTOFAVAIL: 248, // (list)(str) names 'dirs/like/this' (includes programs ?) (this might be multiple packets?)
  // business ... we should be able to centralize all control w/i view.js if we can write these
  REQADDHUNK: 247, // (str) name
  REQNAMECHANGE: 246,
  HUNKALIVE: 245, // (hunkdescription): name, id, inputlist, outputlist, statelist
  HUNKREPLACE: 244,
  REQSTATECHANGE: 243,
  HUNKSTATECHANGE: 242,
  REQRMHUNK: 241, // (str) id
  HUNKREMOVED: 240, // (str) id
  REQADDLINK: 239, // (str) id, (str) outname, (str) id, (str) inname
  LINKALIVE: 238, // (str) id, (str) outname, (str) id, (str) inname
  REQRMLINK: 237, // (str) id, (str) outname, (str) id, (str) inname
  LINKREMOVED: 236, // (str) id, (str) outname, (str) id, (str) inname
  // to id,
  MSGID: 235
}

// hunk description keys,
const HK = {
  NAME: 253,
  TYPE: 252,
  IND: 251,
  DESCR: 250,
  INPUT: 249,
  OUTPUT: 247,
  CONNECTIONS: 246,
  CONNECTION: 245,
  STATE: 244
}

// link keys,
const LK = {
  ACK: 254,
  HELLO: 253 // ~ binary solo ~
}

// should write out as list of pairs ?
// or write fn to do key(stringtype)

export {
  TSET,
  MK, // manager keys
  HK, // hunk def keys
  LK, // link keys
  MSGS,
  findPhy,
  isIntType,
  isFloatType,
  isNumType
}
