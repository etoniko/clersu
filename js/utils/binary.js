export const prepareData = (a) => new DataView(new ArrayBuffer(a));

export class BinaryReader {
  constructor(view) {
    this.view = view;
    this.byteLength = view.byteLength;
    this.offset = 0;
  }

  get canRead() {
    return this.offset < this.byteLength;
  }

  uint8() {
    return this.view.getUint8(this.offset++);
  }

  uint16() {
    const v = this.view.getUint16(this.offset, true);
    this.offset += 2;
    return v;
  }

  uint32() {
    const v = this.view.getUint32(this.offset, true);
    this.offset += 4;
    return v;
  }

  float32() {
    const v = this.view.getFloat32(this.offset, true);
    this.offset += 4;
    return v;
  }

  utf16() {
    let str = "";
    let char;
    while (this.canRead && (char = this.uint16())) {
      str += String.fromCharCode(char);
    }
    return str;
  }
}

export class Writer {
  constructor() {
    this._b = [];
  }

  setUint8(a) {
    this._b.push(a & 255);
    return this;
  }

  setUint16(a) {
    this._b.push(a & 255, (a >> 8) & 255);
    return this;
  }

  setUint32(a) {
    a >>>= 0;
    this._b.push(a & 255, (a >> 8) & 255, (a >> 16) & 255, (a >> 24) & 255);
    return this;
  }

  setFloat32(a) {
    const buf = new ArrayBuffer(4);
    new DataView(buf).setFloat32(0, a, true);
    const view = new Uint8Array(buf);
    this._b.push(view[0], view[1], view[2], view[3]);
    return this;
  }

  setUtf16(str) {
    for (let i = 0; i < str.length; i++) {
      this.setUint16(str.charCodeAt(i));
    }
    this.setUint16(0);
    return this;
  }

  build() {
    return new Uint8Array(this._b).buffer;
  }
}
