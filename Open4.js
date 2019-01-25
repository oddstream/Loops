// @ts-check
'use strict';

let Open4 = (function(){

window.LOOPS_VERSION = '0.1.24.2';  // for bake

let DEBUGGING = false;

const Q = 100;                          const strQ = String(Q);
const Q45 = Math.floor(Q*0.45);
const Q50 = Math.floor(Q / 2);
const Q55 = Math.floor(Q*0.55);
const Q10 = Math.floor(Q / 10);

const SVG_NAMESPACE = 'http://www.w3.org/2000/svg';

const NORTH = 0b0001;
const EAST  = 0b0010;
const SOUTH = 0b0100;
const WEST  = 0b1000;

const PLACE_COIN_CHANCE = 0.33;

const svgGrx = [
/* 0*/	{ele:'',        attribs: {}},
/* 1*/	{ele:'rect',    attribs:{x:Q45, y:0, width:Q10, height:Q50}},
/* 2*/	{ele:'rect',    attribs:{x:Q50, y:Q45, width:Q50, height:Q10}},
/* 3*/	{ele:'polygon', attribs:{points:`${Q45},0 ${Q55},0 ${Q55},${Q45} ${Q},${Q45} ${Q},${Q55} ${Q45},${Q55}`}},
/* 4*/	{ele:'rect',    attribs:{x:Q45, y:Q50, width:Q10, height:Q50}},
/* 5*/	{ele:'rect',    attribs:{x:Q45, y:0, width:Q10, height:Q}},
/* 6*/	{ele:'polygon', attribs:{points:`${Q45},${Q45} ${Q},${Q45} ${Q},${Q55} ${Q55},${Q55} ${Q55},${Q} ${Q45},${Q}`}},
/* 7*/	{ele:'polygon', attribs:{points:`${Q45},0 ${Q55},0 ${Q55},${Q45} ${Q},${Q45} ${Q},${Q55} ${Q55},${Q55} ${Q55},${Q} ${Q45},${Q}`}},
/* 8*/	{ele:'rect',    attribs:{x:0, y:Q45, width:Q50, height:Q10}},
/* 9*/	{ele:'polygon', attribs:{points:`${Q45},0 ${Q55},0 ${Q55},${Q55} 0,${Q55} 0,${Q45} ${Q45},${Q45}`}},
/*10*/	{ele:'rect',    attribs:{x:0, y:Q45, width:Q, height:Q10}},
/*11*/	{ele:'polygon', attribs:{points:`${Q45},0 ${Q55},0 ${Q55},${Q45} ${Q},${Q45} ${Q},${Q55} 0,${Q55} 0,${Q45} ${Q45},${Q45}`}},
/*12*/	{ele:'polygon', attribs:{points:`0,${Q45} ${Q55},${Q45} ${Q55},${Q} ${Q45},${Q} ${Q45},${Q55} 0,${Q55}`}},
/*13*/	{ele:'polygon', attribs:{points:`${Q45},0 ${Q55},0 ${Q55},${Q} ${Q45},${Q} ${Q45},${Q55} 0,${Q55} 0,${Q45} ${Q45},${Q45}`}},
/*14*/	{ele:'polygon', attribs:{points:`0,${Q45} ${Q},${Q45} ${Q},${Q55} ${Q55},${Q55} ${Q55},${Q} ${Q45},${Q} ${Q45},${Q55} 0,${Q55}`}},
/*15*/	{ele:'polygon', attribs:{points:`${Q45},0 ${Q55},0 ${Q55},${Q45} ${Q},${Q45} ${Q},${Q55} ${Q55},${Q55} ${Q55},${Q} ${Q45},${Q} ${Q45},${Q55} 0,${Q55} 0,${Q45} ${Q45},${45}`}}
];

const gameState = new GameState(2);

/**
 * Helper function to create SVG element and set attributes
 * @param {string} name 
 * @param {any} attribs 
 * @return {SVGSVGElement}
 */
function createSVGElement(name, attribs) {
  /** @type {SVGSVGElement} */
  const e = document.createElementNS(SVG_NAMESPACE, name);
  for ( let a in attribs ) {
    e.setAttributeNS(null, a, attribs[a]);
  }
  return e;
}

class Tile {
  /**
   * @param {SVGSVGElement} parentElement 
   * @param {number} x grid position
   * @param {number} y grid position
   */
  constructor(parentElement, x,y) {
    this.x = x;
    this.y = y;
    this.n = this.e = this.w = this.s = null;
    this.coins = 0;
    this.svg = createSVGElement('svg', {
      'x': String(x*Q),
      'y': String(y*Q),
      'width': strQ,
      'height': strQ
    });
    this.svg.addEventListener('pointerup', this);
    this.svg.classList.add('tile');
    parentElement.appendChild(this.svg);
  }

  rotate5() {
    const g = this.svg.querySelector('.object');
    if ( !g ) {
      console.error('cannot find element to rotate');
      return;
    }

    return new Promise(function(resolve /*, reject*/) {
      let angle = 10;

      const spinSVG = () => {
        g.setAttributeNS(null, 'transform', `rotate(${angle} ${Q50},${Q50})`);
        angle += 10;
        if ( angle < 90 )
          window.requestAnimationFrame(spinSVG);
        else
          resolve();
      };
      window.requestAnimationFrame(spinSVG);
    });
  }

  shiftBits() {
    if ( this.coins & 0b1000 )
      this.coins = ((this.coins << 1) & 0b1111) | 0b0001;
    else
      this.coins = (this.coins << 1) & 0b1111;
  }

  isTileComplete() {
    // objects are allowed to touch the edge
    if ( this.coins & NORTH ) {
      if ( this.n && (this.n.coins & SOUTH) ) {
        return false;
      }
    }
    if ( this.coins & EAST ) {
      if ( this.e && (this.e.coins & WEST) ) {
        return false;
      }
    }
    if ( this.coins & WEST ) {
      if ( this.w && (this.w.coins & EAST) ) {
        return false;
      }
    }
    if ( this.coins & SOUTH ) {
      if ( this.s && (this.s.coins & NORTH) ) {
        return false;
      }
    }
    return true;
  }

  getRoot() {
    let t = this;
    while (t.w) t = t.w;
    while (t.n) t = t.n;
    return t;
  }

  *createIterator() {
    for ( let y = this.getRoot(); y; y = y.s ) {
      for ( let x = y; x; x = x.e ) {
        yield x;
      }
    }
  }

  isGridComplete() {
    for ( const t of this.createIterator() )
      if ( !t.isTileComplete() )
        return false;
    return true;
  }

  placeCoin() {
    if ( this.e ) {
      if ( Math.random() < PLACE_COIN_CHANCE ) {
          this.coins = this.coins | EAST;
          this.e.coins = this.e.coins | WEST;
      }
    }
    if ( this.s ) {
      if ( Math.random() < PLACE_COIN_CHANCE ) {
        this.coins = this.coins | SOUTH;
        this.s.coins = this.s.coins | NORTH;
      }
    }
  }

  // Tile implements the https://developer.mozilla.org/en-US/docs/Web/API/EventListener interface
  /**
   * @param {PointerEvent} event 
   */
  handleEvent(event) {
    if ( this.isGridComplete() ) {
      window.location.reload(false);
      return;
    }

    if ( 0 === this.coins )
      return;

    this.rotate5()
    .then( () => {
      this.shiftBits();
      this.setGraphic();
      if ( this.isGridComplete() ) {
        gameState.gridSolved();
        for ( const t of this.createIterator() ) {
          const e = t.svg.querySelector('.object');
          if ( e )
            e.classList.add('completed');
        }
      }
    });
  }

  setGraphic() {
    while ( this.svg.lastChild )
      this.svg.removeChild(this.svg.lastChild);

    // dummy rect to capture pointer event
    const r = createSVGElement('rect', {
      'x': '0',
      'y': '0',
      'width': strQ,
      'height': strQ
    });
    this.svg.appendChild(r);

    if ( this.coins ) {
      const s = svgGrx[this.coins];
      const e = createSVGElement(s.ele, s.attribs);
      e.classList.add('object');
      this.svg.appendChild(e);
    }
  }
}

class GridOfTiles {
  /**
   * @param {number=} numX 
   * @param {number=} numY 
   */
  constructor(numX = 7, numY = 5) {
    this.numX = numX;
    this.numY = numY;

    /** @type {SVGSVGElement} */
    this.svg = createSVGElement('svg', {
      'id': 'gridoftiles',
      'width': String(Q * this.numX),
      'height': String(Q * this.numY),
      'viewBox': `0 0 ${Q * this.numX} ${Q * this.numX}`,
      'preserveAspectRatio': 'xMinYMin slice'
    });
    this.svg.classList.add('grid');
    document.body.appendChild(this.svg);

    /** @type {Tile} */
    this.grid = this.createFirstRow(this.svg, numX);
    let prevRow = this.grid;
    for ( let y=1; y<numY; y++ ) {
      prevRow = this.createNextRow(this.svg, numX, prevRow);
    }
  }

  /**
   * @param {SVGSVGElement} parentElement 
   * @param {number} n 
   * @return {Tile}
   */
  createFirstRow(parentElement, n) {
    let tRoot = null;
    let tPrev = tRoot;
    for ( let i=0; i<n; i++ ) {
      if ( null === tRoot ) {
        tRoot = new Tile(parentElement, 0, 0);
        tPrev = tRoot;
      } else {
        const tNew = new Tile(parentElement, i, 0);
        // link
        tPrev.e = tNew;
        tPrev.e.w = tPrev;
        // move on
        tPrev = tNew;
      }
    }
    return tRoot;
  }

  /**
   * @param {SVGSVGElement} parentElement 
   * @param {number} n 
   * @param {Tile} prevRow
   * @return {Tile}
   */
  createNextRow(parentElement, n, prevRow) {
    let tRoot = null;
    let tPrev = tRoot;
    for ( let i=0; i<n; i++ ) {
      if ( null === tRoot ) {
        tRoot = new Tile(parentElement, 0, prevRow.y + 1);
        tRoot.n = prevRow;
        tRoot.n.s = tRoot;

        tPrev = tRoot;
        prevRow = prevRow.e;
      } else {
        const tNew = new Tile(parentElement, i, prevRow.y + 1);
        // link
        tPrev.e = tNew;
        tPrev.e.w = tPrev;
        tNew.n = prevRow;
        tNew.n.s = tNew;
        // move on
        tPrev = tNew;
        prevRow = prevRow.e;
      }
    }
    return tRoot;
  }

  placeCoins() {
    for ( const t of this.createIterator() ) {
      t.placeCoin();
    }
    return this;
  }

  placeCoinsSymmetrically() {
    const xHalf = Math.floor(this.numX / 2);
    const yHalf = Math.floor(this.numY / 2);

    let y1 = this.grid; while (y1.s) y1 = y1.s;
    for ( let yCount = 0, y = this.grid; yCount < yHalf; yCount++ , y = y.s )  {
      let x1 = y; while (x1.e) x1 = x1.e;
      for ( let xCount = 0, x = y; xCount < xHalf; xCount++ , x = x.e ) {
        // place the top left coin
        x.placeCoin();

        // mirror the coin to the top right
        if ( x.coins & EAST ) 
        {
            x1.coins |= WEST;
            x1.w.coins |= EAST;
        }
        if ( x.coins & SOUTH ) 
        {
            x1.coins |= SOUTH;
            x1.s.coins |= NORTH;
        }
        x1 = x1.w;
      }

      y1 = y1.n;
    }

    // now a second pass, mirroring top to bottom

    let x1 = this.grid; while (x1.e) x1 = x1.e;
    for ( let x = this.grid; x; x = x.e ) {  // go all the way across
      let y1 = x; while (y1.s) y1 = y1.s;
      for ( let yCount = 0, y = x; yCount < yHalf; yCount++ , y = y.s ) {
        if ( y.coins & EAST ) {
          y1.coins |= EAST;
          y1.e.coins |= WEST;
        }
        if ( y.coins & SOUTH ) {
          y1.coins |= NORTH;
          y1.n.coins |= SOUTH;
        }
        y1 = y1.n;
      }

      x1 = x1.w;
    }

    return this;
  }

  setGraphics() {
    document.title = `Loop 2 Level ${gameState.level}`;
  
    for ( const t of this.createIterator() )
      t.setGraphic();

    return this;
  }

  *createIterator() {
    // loop y outside x to generate grid elements in correct order
    for ( let y = this.grid; y; y = y.s ) {
      for ( let x = y; x; x = x.e ) {
        yield x;
      }
    }
  }
}

function main() {
  const urlParams = Util.getCommandLine();

  DEBUGGING = urlParams.debug ? urlParams.debug : false;
  let numX = urlParams.x ? urlParams.x : Math.max(Math.floor(window.innerWidth / Q) - 1, 5);
  let numY = urlParams.y ? urlParams.y : Math.max(Math.floor(window.innerHeight / Q) - 1, 5);

  const got = new GridOfTiles(numX, numY);
  let fn = Math.random() < 0.5 ? got['placeCoins'] : got['placeCoinsSymmetrically'];
  fn.call(got).setGraphics();
}

main();
}());
