// @ts-check
'use strict';

let Loop4 = (function() {

window.LOOPS_VERSION = '0.1.25.0';

let DEBUGGING = false;

const Q = 100;                          const strQ = Q.toString();
const Q50 = Math.floor(Q / 2);
const Q25 = Math.floor(Q / 4);
const Q10 = Math.floor(Q / 10);         const strQ10 = Q10.toString();
const Q75 = Math.floor((Q / 4) * 3);

const SVG_NAMESPACE = 'http://www.w3.org/2000/svg';

const NORTH = 0b0001;
const EAST  = 0b0010;
const SOUTH = 0b0100;
const WEST  = 0b1000;

const PLACE_COIN_CHANCE = 0.66;

const gameState = new GameState(4);

const colors = [
  'brown',
  'darkgreen',
  'darkolivegreen',
  'darkred',
  'gold',
  'gray',
  'mediumslateblue',
  'mediumvioletred',
  'midnightblue',
  'olive',
  'orange',
  'slateblue',
  'teal'
];

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

function _circle(g) {
  g.appendChild(createSVGElement('circle', { r: Q25, cx: Q50, cy: Q50 }));
}

function _empty(g) {
}
function _singleN(g) {
  _circle(g);
  g.appendChild(createSVGElement('line', { x1: Q50, y1: 0, x2: Q50, y2: Q25 }));
}
function _singleE(g) {
  _circle(g);
  g.appendChild(createSVGElement('line', { x1: Q, y1: Q50, x2: Q75, y2: Q50 }));
}
function _curveNE(g) {
  g.appendChild(createSVGElement('path', { d: `M${Q50},0 A${Q50},${Q50} 0 0 0 ${Q},${Q50}` }));   // SweepFlag 0 = anticlockwise
}
function _singleS(g) {
  _circle(g);
  g.appendChild(createSVGElement('line', { x1: Q50, y1: Q, x2: Q50, y2: Q75 }));
}
function _lineNS(g) {
  g.appendChild(createSVGElement('line', { x1: Q50, y1: 0, x2: Q50, y2: Q }));
}
function _curveSE(g){
  g.appendChild(createSVGElement('path', { d: `M${Q50},${Q} A${Q50},${Q50} 0 0 1 ${Q},${Q50}` }));    // SweepFlag 1 = clockwise
}
function _triNES(g) {
  _curveNE(g);
  _curveSE(g);
}
function _singleW(g) {
  _circle(g);
  g.appendChild(createSVGElement('line', { x1: 0, y1: Q50, x2: Q25, y2: Q50 }));
}
function _curveNW(g) {
  g.appendChild(createSVGElement('path', { d: `M${Q50},0 A${Q50},${Q50} 0 0 1 0,${Q50}` }));  // SweepFlag 1 = clockwise
}
function _lineEW(g) {
  g.appendChild(createSVGElement('line', { x1: 0, y1: Q50, x2: Q, y2: Q50 }));
}
function _triNEW(g) {
  _curveNE(g);
  _curveNW(g);
}
function _curveSW(g) {
  g.appendChild(createSVGElement('path', { d: `M${Q50},${Q} A${Q50},${Q50} 0 0 0 0,${Q50}` }));   // SweepFlag 0 = anticlockwise
}
function _triNSW(g) {
  _curveNW(g);
  _curveSW(g);
}
function _triEWS(g) {
  _curveSW(g);
  _curveSE(g);
}
function _four(g) {
  _curveNE(g);
  _curveSE(g);
  _curveSW(g);
  _curveNW(g);
}

// array of functions to call to create graphics
const svgGrx = [
/* 0*/  _empty,
/* 1*/  _singleN,
/* 2*/  _singleE,
/* 3*/  _curveNE,
/* 4*/  _singleS,
/* 5*/  _lineNS,
/* 6*/  _curveSE,
/* 7*/  _triNES,
/* 8*/  _singleW,
/* 9*/  _curveNW,
/*10*/  _lineEW,
/*11*/  _triNEW,
/*12*/  _curveSW,
/*13*/  _triNSW,
/*14*/  _triEWS,
/*15*/  _four
];

class Tile {
  /**
   * @param {SVGSVGElement} parentElement 
   * @param {number} x grid position
   * @param {number} y grid position
   */
  constructor(parentElement, x, y) {
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
    const g = this.svg.querySelector('.boldobject');
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

  unshiftBits() {
    if ( this.coins & 0b0001 )
      this.coins = (this.coins >> 1) | 0b1000;
    else
      this.coins = this.coins >> 1;
  }

  isTileComplete() {
    if ( this.coins & NORTH ) {
      if ( (this.n === null) || !(this.n.coins & SOUTH) ) {
        return false;
      }
    }
    if ( this.coins & EAST ) {
      if ( (this.e === null) || !(this.e.coins & WEST) ) {
        return false;
      }
    }
    if ( this.coins & WEST ) {
      if ((this.w === null) || !(this.w.coins & EAST)) {
        return false;
      }
    }
    if ( this.coins & SOUTH ) {
      if ( (this.s === null) || !(this.s.coins & NORTH) ) {
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

  /**
   * @param {Tile} tRoot
   */
  *createIterator(tRoot) {
    for ( let y = tRoot; y; y = y.s ) {
      for ( let x = y; x; x = x.e ) {
        yield x;
      }
    }
  }

  isGridComplete() {
    for ( const t of this.createIterator(this.getRoot()) )
      if ( !t.isTileComplete() )
        return false;
    return true;
  }

  placeCoin() {
    if ( this.e ) {
      if ( Math.random() > PLACE_COIN_CHANCE ) {
        this.coins = this.coins | EAST;
        this.e.coins = this.e.coins | WEST;
      }
    }
    if ( this.s ) {
      if ( Math.random() > PLACE_COIN_CHANCE ) {
        this.coins = this.coins | SOUTH;
        this.s.coins = this.s.coins | NORTH;
      }
    }
  }

  jumbleCoin() {
    if ( DEBUGGING ) {
      if ( Math.random() > 0.95 )
        this.unshiftBits();
    } else {
      if ( Math.random() < gameState.jumbleCoinChance ) {
        if ( Math.random() > 0.5 )
          this.shiftBits();
        else
          this.unshiftBits();
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

    this.rotate5()
    .then( () => { 
      this.shiftBits();
      this.setGraphic(); 
      if ( this.isGridComplete() ) {
        gameState.gridSolved();
        for ( const t of this.createIterator(this.getRoot()) ) {
          const e = t.svg.querySelector('.boldobject');
          if ( e )
            e.classList.add('boldcompleted');
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

    const g = createSVGElement('g', {});
    g.classList.add('boldobject');
    svgGrx[this.coins](g);
    this.svg.appendChild(g);
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
    for ( const t of this.grid.createIterator(this.grid) )
      t.placeCoin();

    return this;
  }

  placeCoinsSymmetrically() {
    const xHalf = Math.floor(this.numX / 2);
    const yHalf = Math.floor(this.numY / 2);

    let y1 = this.grid; while (y1.s) y1 = y1.s;
    for ( let yCount = 0, y = this.grid; yCount < yHalf; yCount++ , y = y.s ) {
      let x1 = y; while (x1.e) x1 = x1.e;
      for ( let xCount = 0, x = y; xCount < xHalf; xCount++ , x = x.e ) {
        // place the top left coin
        x.placeCoin();

        // mirror the coin to the top right
        if ( x.coins & EAST ) {
          x1.coins |= WEST;
          x1.w.coins |= EAST;
        }
        if ( x.coins & SOUTH ) {
          x1.coins |= SOUTH;
          x1.s.coins |= NORTH;
        }
        x1 = x1.w;
      }

      y1 = y1.n;
    }

    // now a second pass, mirroring top to bottom

    let x1 = this.grid; while (x1.e) x1 = x1.e;
    for ( let x = this.grid; x; x = x.e ) {
      // go all the way across
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

  jumbleCoins() {
    for ( const t of this.grid.createIterator(this.grid) ) 
      t.jumbleCoin();

    return this;
  }

  setGraphics() {
    document.title = `Loop 4 Level ${gameState.level}`;
    
    for ( const t of this.grid.createIterator(this.grid) )
      t.setGraphic();

    return this;
  }
}

function main()
{
    const urlParams = Util.getCommandLine();

    DEBUGGING = urlParams.debug ? urlParams.debug : false;
    let numX = urlParams.x ? urlParams.x : Math.max(Math.floor(window.innerWidth / Q) - 1, 5);
    let numY = urlParams.y ? urlParams.y : Math.max(Math.floor(window.innerHeight / Q) - 1, 5);

    document.documentElement.style.setProperty('--obj-color', colors[Math.floor(Math.random()*colors.length)]);

    const got = new GridOfTiles(numX, numY);
    let fn = Math.random() < 0.5 ? got['placeCoins'] : got['placeCoinsSymmetrically'];
    fn.call(got).jumbleCoins().setGraphics();
}

main();

})();
