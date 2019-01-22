// @ts-check

'use strict';

let DEBUGGING = false;
let DESIGNING = false;

const VERSION = '0.1.22.0';

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

// https://en.wikipedia.org/wiki/Web_colors
const BACKGROUND_COLOR = 'powderblue';
const INPROGRESS_COLOR = 'navy';
const COMPLETED_COLOR = 'black';

const gameState = new GameState(4);

class SvgHelper
{
    constructor()
    {
        this.fun = [
            SvgHelper.empty,         // 0
            SvgHelper.singleN,       // 1
            SvgHelper.singleE,       // 2
            SvgHelper.curveNE,       // 3
            SvgHelper.singleS,       // 4
            SvgHelper.lineNS,        // 5
            SvgHelper.curveSE,       // 6
            SvgHelper.triNES,        // 7
            SvgHelper.singleW,       // 8
            SvgHelper.curveNW,       // 9
            SvgHelper.lineEW,        // 10
            SvgHelper.triNEW,        // 11
            SvgHelper.curveSW,       // 12
            SvgHelper.triNSW,        // 13
            SvgHelper.triEWS,        // 14
            SvgHelper.four           // 15
        ];
    }

    static buildElement(eleName, attLst)
    {
        let ele = document.createElementNS(SVG_NAMESPACE, eleName);
        // attLst is like { r: 25, cx: 0, cy: 100 }
        Object.keys(attLst).forEach((key) =>
            ele.setAttributeNS(null, key, attLst[key])
        );
        return ele;
    }

    static circle(g)
    {
        g.appendChild(SvgHelper.buildElement('circle', { r: Q25, cx: Q50, cy: Q50 }));
    }

    static empty(g)
    {
    }
    static singleN(g)
    {
        SvgHelper.circle(g);
        g.appendChild(SvgHelper.buildElement('line', { x1: Q50, y1: 0, x2: Q50, y2: Q25 }));
    }
    static singleE(g) 
    {
        SvgHelper.circle(g);
        g.appendChild(SvgHelper.buildElement('line', { x1: Q, y1: Q50, x2: Q75, y2: Q50 }));
    }
    static curveNE(g) 
    {
        g.appendChild(SvgHelper.buildElement('path', { d: `M${Q50},0 A${Q50},${Q50} 0 0 0 ${Q},${Q50}` }));   // SweepFlag 0 = anticlockwise
    }
    static singleS(g) 
    {
        SvgHelper.circle(g);
        g.appendChild(SvgHelper.buildElement('line', { x1: Q50, y1: Q, x2: Q50, y2: Q75 }));
    }
    static lineNS(g) 
    {
        g.appendChild(SvgHelper.buildElement('line', { x1: Q50, y1: 0, x2: Q50, y2: Q }));
    }
    static curveSE(g) 
    {
        g.appendChild(SvgHelper.buildElement('path', { d: `M${Q50},${Q} A${Q50},${Q50} 0 0 1 ${Q},${Q50}` }));    // SweepFlag 1 = clockwise
    }
    static triNES(g) 
    {
        SvgHelper.curveNE(g);
        SvgHelper.curveSE(g);
    }
    static singleW(g) 
    {
        SvgHelper.circle(g);
        g.appendChild(SvgHelper.buildElement('line', { x1: 0, y1: Q50, x2: Q25, y2: Q50 }));
    }
    static curveNW(g) 
    {
        g.appendChild(SvgHelper.buildElement('path', { d: `M${Q50},0 A${Q50},${Q50} 0 0 1 0,${Q50}` }));  // SweepFlag 1 = clockwise
    }
    static lineEW(g) 
    {
        g.appendChild(SvgHelper.buildElement('line', { x1: 0, y1: Q50, x2: Q, y2: Q50 }));
    }
    static triNEW(g) 
    {
        SvgHelper.curveNE(g);
        SvgHelper.curveNW(g);
    }
    static curveSW(g) 
    {
        g.appendChild(SvgHelper.buildElement('path', { d: `M${Q50},${Q} A${Q50},${Q50} 0 0 0 0,${Q50}` }));   // SweepFlag 0 = anticlockwise
    }
    static triNSW(g) 
    {
        SvgHelper.curveNW(g);
        SvgHelper.curveSW(g);
    }
    static triEWS(g) 
    {
        SvgHelper.curveSW(g);
        SvgHelper.curveSE(g);
    }
    static four(g) 
    {
        SvgHelper.curveNE(g);
        SvgHelper.curveSE(g);
        SvgHelper.curveSW(g);
        SvgHelper.curveNW(g);
    }
}

function Tile() 
{
    this.n = this.e = this.w = this.s = null;
    this.coins = this.originalCoins = 0;
    this.div = null;
}
{
    /**
     * Create a row of 'n' e-w linked Tile objects 
     */
    Tile.prototype.createRow = function(n)
    {
        let tRoot = null;

        while ( n )
        {
            if ( null === tRoot )
            {
                tRoot = new Tile();
            }
            else
            {
                let tNew = new Tile();
                tNew.e = tRoot;
                tRoot.w = tNew;
                tRoot = tNew; 
            }
            n -= 1;
        }
        return tRoot;
    };

    /**
     *  Create a new row under 'tRow', linking n-s 
     */
    Tile.prototype.createRowBelow = function(tRow)
    {
        let tPrev = null;

        for ( let t = tRow; t; t = t.e )
        {
            let tNew = new Tile();
            tNew.n = t;
            t.s = tNew;
            
            if ( tPrev )
            {
                tNew.w = tPrev;
                tPrev.e = tNew;
            }
            tPrev = tNew;
        }

        return tRow.s;
    };

    Tile.prototype.rotate5 = function()
    {
        const g = this.div.querySelector('use');

        return new Promise(function(resolve /*, reject*/)
        {
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
    };

    Tile.prototype.shiftBits = function()
    {
        if ( this.coins & 0b1000 )
            this.coins = ((this.coins << 1) & 0b1111) | 0b0001;
        else
            this.coins = (this.coins << 1) & 0b1111;
    };

    Tile.prototype.unshiftBits = function()
    {
        if ( this.coins & 0b0001 )
            this.coins = (this.coins >> 1) | 0b1000;
        else
            this.coins = this.coins >> 1;
    };

    Tile.prototype.isTileComplete = function() 
    {
        if (this.coins & NORTH) {
            if ((this.n === null) || !(this.n.coins & SOUTH)) {
                return false;
            }
        }
        if (this.coins & EAST) {
            if ((this.e === null) || !(this.e.coins & WEST)) {
                return false;
            }
        }
        if (this.coins & WEST) {
            if ((this.w === null) || !(this.w.coins & EAST)) {
                return false;
            }
        }
        if (this.coins & SOUTH) {
            if ((this.s === null) || !(this.s.coins & NORTH)) {
                return false;
            }
        }
        return true;
    };

    Tile.prototype.getRoot = function()
    {
        let t = this;
        while (t.w) t = t.w;
        while (t.n) t = t.n;
        return t;
    };

    Tile.prototype.createIterator = function* (tRoot)
    {
        for ( let y = tRoot; y; y = y.s ) 
        {
            for ( let x = y; x; x = x.e ) 
            {
                yield x;
            }
        }
    };

    Tile.prototype.isGridComplete = function() 
    {
        for ( const t of this.createIterator(this.getRoot()) )
            if ( !t.isTileComplete() )
                return false;
        return true;
    };

    Tile.prototype.placeCoin = function() 
    {
        if ( this.e ) {
            if (Math.random() > PLACE_COIN_CHANCE) {
                this.coins = this.coins | EAST;
                this.e.coins = this.e.coins | WEST;
            }
        }
        if ( this.s ) {
            if (Math.random() > PLACE_COIN_CHANCE) {
                this.coins = this.coins | SOUTH;
                this.s.coins = this.s.coins | NORTH;
            }
        }
    };

    Tile.prototype.jumbleCoin = function() 
    {
        if ( DESIGNING )
            return;

        if ( DEBUGGING )
        {
            if ( Math.random() > 0.95 )
                this.unshiftBits();
        }
        else 
        {
            if ( Math.random() < gameState.jumbleCoinChance ) 
            {
                if ( Math.random() > 0.5 )
                    this.shiftBits();
                else
                    this.unshiftBits();
            }
        }
    };

    Tile.prototype.strokeItBlack = function()
    {
        const ele = this.div.querySelector('svg');
        if ( ele )
            ele.setAttributeNS(null, 'stroke', COMPLETED_COLOR);
    };

    Tile.prototype.toggle = function(x,y)
    {
        const toggleBit = function(t, tOpp, bit, oppBit)
        {
            if ( null === tOpp )
                return;

            if ( t.coins & bit )
            {
                t.coins &= ~bit;
                tOpp.coins &= ~oppBit;
            }
            else
            {
                t.coins |= bit;
                tOpp.coins |= oppBit;
            }
    
            t.setGraphic();
            tOpp.setGraphic();
        };
    
        if ( Util.pointInTriangle(x,y, 0,0, Q,0, Q50, Q50) )
            toggleBit(this, this.n, NORTH, SOUTH);
        else if ( Util.pointInTriangle(x,y, Q,0, Q,Q, Q50, Q50) )
            toggleBit(this, this.e, EAST, WEST);
        else if ( Util.pointInTriangle(x, y, 0,Q, Q,Q, Q50, Q50) )
            toggleBit(this, this.s, SOUTH, NORTH);
        else if ( Util.pointInTriangle(x, y, 0,0, 0,Q, Q50, Q50) )
            toggleBit(this, this.w, WEST, EAST);
    };

    // Tile implements the https://developer.mozilla.org/en-US/docs/Web/API/EventListener interface
    Tile.prototype.handleEvent = function (event) 
    {   // event.type == "click"
        if ( DESIGNING )
        {
            this.toggle(event.offsetX, event.offsetY);
            return;
        }

        if ( this.isGridComplete() )
        {
            window.location.reload(false);
            return;
        }

        this.rotate5()
        .then( () => { 
            this.shiftBits();
            this.setGraphic(); 
            if ( this.isGridComplete() )
            {
                gameState.gridSolved();

                for ( const t of this.createIterator(this.getRoot()) )
                    t.strokeItBlack();
                // document.querySelector returns an Element, not an HTMLElement
                //@ts-ignore property 'style' does not exist on type 'Element'
                document.querySelector('div.gridoftiles').style.borderColor = COMPLETED_COLOR;
            }
        });
    };

    Tile.prototype.setGraphic = function() 
    {
        const svg = document.createElementNS(SVG_NAMESPACE, 'svg');
        svg.setAttributeNS(null, 'width', strQ);
        svg.setAttributeNS(null, 'height', strQ);
        svg.setAttributeNS(null, 'stroke', INPROGRESS_COLOR);
        svg.setAttributeNS(null, 'stroke-width', strQ10);
        svg.setAttributeNS(null, 'fill', 'none');

        if ( DESIGNING )
        {
            const eleSvgPath = document.createElementNS(SVG_NAMESPACE, 'path');
            eleSvgPath.setAttributeNS(null, 'd', `M 0,0 L ${Q},0 L ${Q},${Q} L 0,${Q} Z`);
            eleSvgPath.setAttributeNS(null, 'stroke-width', '1');
            svg.appendChild(eleSvgPath);
        }

//        this.div.addEventListener("click", this);

        const u = document.createElementNS(SVG_NAMESPACE, 'use');
        u.setAttributeNS(null, 'href', `#tile${this.coins}`);
        svg.appendChild(u);

        while (this.div.lastChild)
            this.div.removeChild(this.div.lastChild);
        this.div.appendChild(svg);
    };
}

function GridOfTiles(numX = 7, numY = 5) 
{
    this.numX = numX;
    this.numY = numY;
    this.grid = Tile.prototype.createRow(numX);

    for ( let t=this.grid; --numY; t=Tile.prototype.createRowBelow(t) ) {
    }

    document.body.onkeydown = this.handleEventKeyDown.bind(this);
}
{
    GridOfTiles.prototype.placeCoins = function(arrCoins)
    {
        if ( arrCoins )
        {
            let i = 0;
            for ( const t of this.grid.createIterator(this.grid) )
                t.coins = arrCoins[i++];
        }
        else
        {
            for ( const t of this.grid.createIterator(this.grid) )
                t.placeCoin();
        }

        for ( const t of this.grid.createIterator(this.grid) )
            t.originalCoins = t.coins;

        return this;
    };

    GridOfTiles.prototype.placeCoinsSymmetrically = function() 
    {
        const xHalf = Math.floor(this.numX / 2);
        const yHalf = Math.floor(this.numY / 2);

        let y1 = this.grid; while (y1.s) y1 = y1.s;
        for ( let yCount = 0, y = this.grid; yCount < yHalf; yCount++ , y = y.s ) 
        {
            let x1 = y; while (x1.e) x1 = x1.e;
            for ( let xCount = 0, x = y; xCount < xHalf; xCount++ , x = x.e ) 
            {
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
        for ( let x = this.grid; x; x = x.e )   // go all the way across
        {
            let y1 = x; while (y1.s) y1 = y1.s;
            for (let yCount = 0, y = x; yCount < yHalf; yCount++ , y = y.s) 
            {
                if ( y.coins & EAST ) 
                {
                    y1.coins |= EAST;
                    y1.e.coins |= WEST;
                }
                if ( y.coins & SOUTH ) 
                {
                    y1.coins |= NORTH;
                    y1.n.coins |= SOUTH;
                }
                y1 = y1.n;
            }

            x1 = x1.w;
        }

        for ( const t of this.grid.createIterator(this.grid) )
            t.originalCoins = t.coins;

        return this;
    };

    GridOfTiles.prototype.jumbleCoins = function() 
    {
        if ( DESIGNING )
            return this;

        for ( const t of this.grid.createIterator(this.grid) ) 
            t.jumbleCoin();

        return this;
    };

    GridOfTiles.prototype.createHTML = function() 
    {
        const hlp = new SvgHelper();

        const eleSymbols = document.createElement('div');
        eleSymbols.className = 'symbols';
//        eleSymbols.setAttribute('display', 'none');
        for ( let i = 0; i < hlp.fun.length; i++ ) 
        {
            const svg = document.createElementNS(SVG_NAMESPACE, 'svg');
            svg.setAttributeNS(null, 'display', 'none');
            eleSymbols.appendChild(svg);

            const sym = document.createElementNS(SVG_NAMESPACE, 'symbol');
            sym.setAttributeNS(null, 'id', `tile${i}`);
            svg.appendChild(sym);

            const g = document.createElementNS(SVG_NAMESPACE, 'g');
            hlp.fun[i](g);
            sym.appendChild(g);
        }
        document.body.appendChild(eleSymbols);

        // create a grid container; all direct children will become grid items
        const eleWrapper = document.createElement('div');
        eleWrapper.className = 'gridoftiles';
        // set attributes; "grid-gap" becomes camelCase "gridGrap"
        eleWrapper.style.display = 'grid';
        // @ts-ignore: Property 'gridGap' does not exist on type 'CSSStyleDeclaration'
        eleWrapper.style.gridGap = '0px 0px';   // auto-sets .gridRowGap and .gridColumnGap
        // @ts-ignore: Property 'gridTemplateRows' does not exist on type 'CSSStyleDeclaration'
        eleWrapper.style.gridTemplateRows = `${Q}px `.repeat(this.numY);        // can't use SVG repeat(5,100px)
        // @ts-ignore: Property 'gridTemplateColumns' does not exist on type 'CSSStyleDeclaration'
        eleWrapper.style.gridTemplateColumns = `${Q}px `.repeat(this.numX);     // can't use SVG repeat(7,100px)
        eleWrapper.style.backgroundColor = BACKGROUND_COLOR;
        eleWrapper.style.border = `${Q10}px solid ${INPROGRESS_COLOR}`;
        eleWrapper.style.width = `${Q * this.numX}px`;
        eleWrapper.style.height = `${Q * this.numY}px`;

        for ( const t of this.grid.createIterator(this.grid) ) 
        {
            // n.b. the iterator must generate the rows across for the HTML grid to work
            t.div = document.createElement('div');
            t.div.addEventListener('click', t);
            eleWrapper.appendChild(t.div);
        }

        document.body.appendChild(eleWrapper);

        return this;
    };

    GridOfTiles.prototype.setGraphics = function() 
    {
        document.title = `Loop 4 Level ${gameState.level}`;
    
        for ( const t of this.grid.createIterator(this.grid) )
            t.setGraphic();

        return this;
    };

    GridOfTiles.prototype.handleEventKeyDown = function(event)
    {   // 'event' is a KeyboardEvent object, event.type == "keydown"
        if ( event.code == 'KeyB' )
        {
            for ( const t of this.grid.createIterator(this.grid) )
                t.coins = t.originalCoins = 0;
            this.setGraphics();            
        }

        if ( event.code == 'KeyJ' )
        {
            for ( const t of this.grid.createIterator(this.grid) )
                t.jumbleCoin();
            this.setGraphics();
        }

        if ( event.code == 'KeyU')
        {
            for ( const t of this.grid.createIterator(this.grid) )
                t.coins = t.originalCoins;
            this.setGraphics();
        }
    };
}

function main()
{
    const urlParams = Util.getCommandLine();

    DEBUGGING = urlParams.debug ? urlParams.debug : false;
    DESIGNING = urlParams.design ? urlParams.design : false;
    let numX = urlParams.x ? urlParams.x : Math.max(Math.floor(window.innerWidth / Q) - 1, 5);
    let numY = urlParams.y ? urlParams.y : Math.max(Math.floor(window.innerHeight / Q) - 1, 5);

    const got = new GridOfTiles(numX, numY);
    got.createHTML();
    let fn = Math.random() < 0.5 ? got['placeCoins'] : got['placeCoinsSymmetrically'];
    fn.call(got).jumbleCoins().setGraphics();
}

main();
