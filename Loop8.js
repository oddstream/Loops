// @ts-check
// TODO check for memory leaks
// TODO find out why SVG onend event doesn't work
// TODO graphics gap at some junctions
// TODO T not working in SVG path after Q

'use strict';

let Loop8 = (function() {

let DEBUGGING = false;
let DESIGNING = false;

const VERSION = '0.1.22.3';

const gameState = new GameState(8);

const Q = 200;                  const strQ = String(Q);
const Q50 = Math.floor(Q/2);    const strQ50 = String(Q50);
const Q10 = Math.floor(Q/10);   const strQ10 = String(Q10); 

const Q3 = Math.floor(Q/3);
const Q6 = Q3+Q3;

const SVG_NAMESPACE = 'http://www.w3.org/2000/svg';

const NORTH     = 0b00000001;
const NORTHEAST = 0b00000010;
const EAST      = 0b00000100;
const SOUTHEAST = 0b00001000;
const SOUTH     = 0b00010000;
const SOUTHWEST = 0b00100000;
const WEST      = 0b01000000;
const NORTHWEST = 0b10000000;

const linkData = [
    { bit: NORTH,       oppBit: SOUTH,     link:'n',    oppLink:'s',    x: strQ50, y: '0',      rect:[Q3,0,Q6,Q3]   },
    { bit: NORTHEAST,   oppBit: SOUTHWEST, link:'ne',   oppLink:'sw',   x: strQ,   y: '0',      rect:[Q6,0,Q,Q3]    },
    { bit: EAST,        oppBit: WEST,      link:'e',    oppLink:'w',    x: strQ,   y: strQ50,   rect:[Q6,Q3,Q,Q6]   },
    { bit: SOUTHEAST,   oppBit: NORTHWEST, link:'se',   oppLink:'nw',   x: strQ,   y: strQ,     rect:[Q6,Q6,Q,Q]    },
    { bit: SOUTH,       oppBit: NORTH,     link:'s',    oppLink:'n',    x: strQ50, y: strQ,     rect:[Q3,Q6,Q6,Q]   },
    { bit: SOUTHWEST,   oppBit: NORTHEAST, link:'sw',   oppLink:'ne',   x: '0',    y: strQ,     rect:[0,Q6,Q3,Q]    },
    { bit: WEST,        oppBit: EAST,      link:'w',    oppLink:'e',    x: '0',    y: strQ50,   rect:[0,Q3,Q3,Q6]   },
    { bit: NORTHWEST,   oppBit: SOUTHEAST, link:'nw',   oppLink:'se',   x: '0',    y: '0',      rect:[0,0,Q3,Q3]    }
];

const PLACE_COIN_CHANCE = 0.2;

// https://en.wikipedia.org/wiki/Web_colors
const BACKGROUND_COLOR = 'lightblue';
const INPROGRESS_COLOR = 'darkblue';
const COMPLETED_COLOR = 'black';
const HIGHLIGHT_COLOR = 'darkorange';

const isOdd = (x) => { return (x&1)==1; };

function addStyle()
{   // this == undefined
    const css = `svg:hover { stroke: ${HIGHLIGHT_COLOR}; }`;
    const style = document.createElement('style');  // magically creates an object with HTMLStyleElement interface
    style.appendChild(document.createTextNode(css));
    document.getElementsByTagName('head')[0].appendChild(style);
}

function removeStyle()
{   // this == undefined
    let ele = null;
    while ( ele = document.querySelector('head>style') )
        ele.parentNode.removeChild(ele);
}

class Tile
{   // all methods will have this == Tile
    constructor()
    {
        this.n = this.ne = this.e = this.se = this.s = this.sw = this.w = this.nw = null;
        this.coins = this.originalCoins = 0;
        this.div = null;
    }

    _getCoinToToggle(x, y)
    {
        function _isInRect(x,y, x1,y1, x2,y2)
        {
            return ( x >= x1 && y >= y1 && x < x2 && y < y2 );
        }

        for ( let ld of linkData )
            if ( _isInRect(x,y, ...ld.rect) )
                return ld;
        return null;
    }

    _toggleCoin(ld)
    {
        if ( null === ld || null === this[ld.link] )
            return;

        if ( this.coins & ld.bit )
        {
            this.coins &= ~ld.bit;
            this[ld.link].coins &= ~ld.oppBit;
        }
        else
        {
            this.coins |= ld.bit;
            this[ld.link].coins |= ld.oppBit;
        }

        this.setGraphic();
        this[ld.link].setGraphic();
    }

    rotate5(clockwise=true, degrees=45)
    {
        const g = this.div.querySelector('g');

        return new Promise(function(resolve /*, reject*/)
        {
            let angle = 5;

            const spinSVG = () => {
                g.setAttributeNS(null, 'transform', `rotate(${clockwise?'':'-'}${angle} ${Q50},${Q50})`);
                angle += 5;
                if ( angle < degrees )
                    window.requestAnimationFrame(spinSVG);
                else
                    resolve();
            };
            window.requestAnimationFrame(spinSVG);
        });
    }
    
    shiftBits(num = 1)
    {
        while ( num-- )
        {
            if ( this.coins & 0b10000000 )
                this.coins = ((this.coins << 1) & 0b11111111) | 0b00000001;
            else
                this.coins = (this.coins << 1) & 0b11111111;

        }
    }

    unshiftBits(num = 1)
    {
        while ( num-- )
        {
            if ( this.coins & 0b00000001 )
                this.coins = (this.coins >> 1) | 0b10000000;
            else
                this.coins = this.coins >> 1;
        }
    }

    unJumble()
    {
        this.coins = this.originalCoins;
        this.setGraphic();
    }

    isTileComplete()
    {
        for ( let chkLink of linkData.filter(chk => this.coins & chk.bit) )
        {
            if ( this[chkLink.link] === null )
                return false;
            if ( !(this[chkLink.link].coins & chkLink.oppBit) )
                return false;
        }
        return true;
    }

    getRoot()
    {
        let t = this;
        while ( t.nw ) t = t.nw;
        while ( t.w ) t = t.w;
        while ( t.n ) t = t.n;
        return t;
    }

    *createIterator(tRoot)
    {
        for ( let y=tRoot; y; y=y.s )
        {
            for ( let x=y; x; x=x.e )
            {
                yield x;
            }
        }
    }

    isGridComplete()
    {
        for ( const t of this.createIterator(this.getRoot()) )
            if ( !t.isTileComplete() )
                return false;
        return true;
    }

    placeCoin()
    {
        if ( this.e )
        {
            if ( Math.random() < PLACE_COIN_CHANCE )
            {
                this.coins = this.coins | EAST;
                this.e.coins = this.e.coins | WEST;
            }
        }
        if ( this.se )
        {
            if ( Math.random() < PLACE_COIN_CHANCE )
            {
                this.coins = this.coins | SOUTHEAST;
                this.se.coins = this.se.coins | NORTHWEST;
            }
        }
        if ( this.s )
        {
            if ( Math.random() < PLACE_COIN_CHANCE )
            {
                this.coins = this.coins | SOUTH;
                this.s.coins = this.s.coins | NORTH;
            }
        }
        if ( this.sw )
        {
            if ( Math.random() < PLACE_COIN_CHANCE )
            {
                this.coins = this.coins | SOUTHWEST;
                this.sw.coins = this.sw.coins | NORTHEAST;
            }
        }
    }

    placeCoinEven()
    {   // for aesthetics, look better if number of coins in tile is even
        const bitCount = Util.hammingWeight(this.coins);
        if ( isOdd(bitCount) )
        {
            if ( this.e && !(this.coins & EAST) )
            {
                this.coins = this.coins | EAST;
                this.e.coins = this.e.coins | WEST;
            }
            else if ( this.s && !(this.coins & SOUTH) )
            {
                this.coins = this.coins | SOUTH;
                this.s.coins = this.s.coins | NORTH;
            }
        }
    }

    jumbleCoin()
    {
        if ( DESIGNING )
            return;

        function getRandomInt(min, max)
        {
            return Math.floor(Math.random() * (max - min + 1)) + min;
        }

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
                    this.shiftBits(getRandomInt(0,4));
                else
                    this.unshiftBits(getRandomInt(0,4));
            }
        }
    }

    handleEvent(event)
    {   // Tile implements the EventListener interface which has a handleEvent method
        if ( DESIGNING )
        {
            this._toggleCoin(this._getCoinToToggle(event.offsetX, event.offsetY));
            return;
        }

        if ( this.isGridComplete() )
        {
            window.setTimeout( () => {
                window.location.reload(false);
            }, 500);            
            return;
        }

        if ( 0 === this.coins )
            return;

        this.rotate5(!event.altKey, 45)
        .then( () => { 
            event.altKey ? this.unshiftBits() : this.shiftBits();
            this.setGraphic(); 
            if ( this.isGridComplete() )
            {
                gameState.gridSolved();

                removeStyle();
    
                for ( const t of this.createIterator(this.getRoot()) )
                    t.strokeItBlack();
            }
        }); 
    }

    strokeItBlack()
    {
        const ele = this.div.querySelector('svg');
        if ( ele )
            ele.setAttributeNS(null, 'stroke', COMPLETED_COLOR);

        for ( const t of this.createIterator(this.getRoot()) )
            if ( 0 === t.coins && t.div.innerText )
                t.div.style['-webkit-text-stroke-color'] = COMPLETED_COLOR;
    }

    setGraphic()
    {
        const svg = document.createElementNS(SVG_NAMESPACE, 'svg');
        svg.setAttributeNS(null, 'width', strQ);
        svg.setAttributeNS(null, 'height', strQ);
        svg.setAttributeNS(null, 'stroke', INPROGRESS_COLOR);
        svg.setAttributeNS(null, 'stroke-width', DEBUGGING ? this.coins == this.originalCoins ? '1' : '2' : '1');
        svg.setAttributeNS(null, 'fill', 'none');
        
        if ( DESIGNING )
        {
            const eleSvgPath = document.createElementNS(SVG_NAMESPACE, 'path');
            eleSvgPath.setAttributeNS(null, 'd', `M 0,0 L ${Q},0 L ${Q},${Q} L 0,${Q} Z`);
            eleSvgPath.setAttributeNS(null, 'stroke-width', '1');
            svg.appendChild(eleSvgPath);
        }

        this.div.addEventListener(/*'click'*/'pointerup', this);

        if ( this.coins )
        {
            const g = document.createElementNS(SVG_NAMESPACE, 'g');
            svg.appendChild(g);

            const bitCount = Util.hammingWeight(this.coins);

            if ( 1 == bitCount )
            {
                const eleLine = document.createElementNS(SVG_NAMESPACE, 'line');
                    const b2p = linkData.find( ele => this.coins == ele.bit );
                    eleLine.setAttributeNS(null, 'x1', b2p.x);
                    eleLine.setAttributeNS(null, 'y1', b2p.y);
                    eleLine.setAttributeNS(null, 'x2', strQ50);
                    eleLine.setAttributeNS(null, 'y2', strQ50);
                g.appendChild(eleLine);

                const eleCircle = document.createElementNS(SVG_NAMESPACE, 'circle');
                    eleCircle.setAttributeNS(null, 'r', strQ10);
                    eleCircle.setAttributeNS(null, 'cx', strQ50);
                    eleCircle.setAttributeNS(null, 'cy', strQ50);
                    eleCircle.setAttributeNS(null, 'fill', BACKGROUND_COLOR);
                g.appendChild(eleCircle);
            }
            else
            {
    /*
        The initial M directive moves the pen to the first point (100,100).
        Two co-ordinates follow the ‘Q’; the single control point (50,50) and the final point we’re drawing to (0,0).
        It draws perfectly good straight lines, too, so no need for separate 'line' element.
    */
                let path = undefined;
                let ldFirst = undefined;
                for ( let ld of linkData )
                {
                    if ( this.coins & ld.bit )
                    {
                        if ( !path )
                        {
                            ldFirst = ld;
                            path = `M${ld.x},${ld.y}`;
                        }
                        else
                        {
    // As with the cubic Bezier curve, there is a shortcut for stringing together multiple quadratic Beziers, called with T.
    // This shortcut looks at the previous control point you used and infers a new one from it.
    // This means that after your first control point, you can make fairly complex shapes by specifying only end points.                        
    //                        if ( path.includes(' Q') )
    //                            if ( path.includes(' T') )
    //                                path = path.concat(` ${ld.x},${ld.y}`);
    //                            else
    //                                path = path.concat(` T${ld.x},${ld.y}`);
    //                        else
                                path = path.concat(` Q${Q50},${Q50} ${ld.x},${ld.y}`);
                        }
                    }
                }
                /*
                    Special cases that look bad
                        NORTHWEST - NORTH - NORTHWEST
                        WEST - NORTHWEST - NORTH
                    All with three coins, so we try to avoid having three coins
                */
                if ( bitCount > 2 )  // close the path for better aesthetics
                {
                    path = path.concat(` Q${Q50},${Q50} ${ldFirst.x},${ldFirst.y}`);
                }
                const ele = document.createElementNS(SVG_NAMESPACE, 'path');
                ele.setAttributeNS(null, 'd', path);
                g.appendChild(ele);
            }
        }

        // this.div > svg > g > path|circle|line
        while ( this.div.lastChild )
            this.div.removeChild(this.div.lastChild);
        this.div.appendChild(svg);
    }

    setGraphicUglyLines()
    {
        const svg = document.createElementNS(SVG_NAMESPACE, 'svg');
        svg.setAttributeNS(null, 'width', strQ);
        svg.setAttributeNS(null, 'height', strQ);
        svg.setAttributeNS(null, 'stroke', INPROGRESS_COLOR);
        svg.setAttributeNS(null, 'stroke-width', DEBUGGING ? this.coins == this.originalCoins ? '1' : '4' : '1');
        svg.setAttributeNS(null, 'fill', 'none');
        
        if ( DESIGNING )
        {
            const eleSvgPath = document.createElementNS(SVG_NAMESPACE, 'path');
            eleSvgPath.setAttributeNS(null, 'd', `M 0,0 L ${Q},0 L ${Q},${Q} L 0,${Q} Z`);
            eleSvgPath.setAttributeNS(null, 'stroke-width', '1');
            svg.appendChild(eleSvgPath);
        }

        this.div.addEventListener('click', this);

        if ( this.coins )
        {
            const g = document.createElementNS(SVG_NAMESPACE, 'g');
            svg.appendChild(g);

            const bitCount = Util.hammingWeight(this.coins);

            for ( let ld of linkData )
            {
                if ( this.coins & ld.bit )
                {
                    const eleLine = document.createElementNS(SVG_NAMESPACE, 'line');
                    eleLine.setAttributeNS(null, 'x1', ld.x);
                    eleLine.setAttributeNS(null, 'y1', ld.y);
                    eleLine.setAttributeNS(null, 'x2', strQ50);
                    eleLine.setAttributeNS(null, 'y2', strQ50);
                    g.appendChild(eleLine);
                }
            }
            if ( 1 == bitCount )
            {
                const eleCircle = document.createElementNS(SVG_NAMESPACE, 'circle');
                eleCircle.setAttributeNS(null, 'r', strQ10);
                eleCircle.setAttributeNS(null, 'cx', strQ50);
                eleCircle.setAttributeNS(null, 'cy', strQ50);
                eleCircle.setAttributeNS(null, 'fill', BACKGROUND_COLOR);
                g.appendChild(eleCircle);
            }
        }

        // this.div > svg > g > path|circle|line
        while ( this.div.lastChild )
            this.div.removeChild(this.div.lastChild);
        this.div.appendChild(svg);
    }
}

class GridOfTiles
{
    constructor(numX=7, numY=5)
    {
        this.numX = numX;
        this.numY = numY;
        this.grid = this.createFirstRow(numX, null);
        let row = numY;

        for ( let nextRow=this.grid; row>1; row--, nextRow=nextRow.s )
        {
            let tPrev = null;
            for ( let t = nextRow; t; t = t.e)
            {
                t.s = new Tile();
                t.s.n = t;

                t.s.w = tPrev;
                if ( tPrev )
                {
                    tPrev.e = t.s;
                }

                tPrev = t.s;
            }
        }
    
        for ( const t of this.grid.createIterator(this.grid) )
        {
            if ( t.e && t.e.n ) { t.ne = t.e.n; t.e.n.sw = t; }         // NORTHEAST
            if ( t.e && t.e.s ) { t.se = t.e.s; t.e.s.nw = t; }         // SOUTHEAST
            if ( t.w && t.w.s ) { t.sw = t.w.s; t.w.s.ne = t; }         // SOUTHWEST
            if ( t.w && t.w.n ) { t.nw = t.w.n; t.w.n.se = t; }         // NORTHWEST
        }

        document.body.onkeydown = this.handleEventKeyDown.bind(this);
    }

    createFirstRow(n, leftTile)
    {
        let t = new Tile();
        t.w = leftTile;
        if ( n > 1 )
        {
            t.e = this.createFirstRow(n-1, t);
        }
        return t;
    }

    placeCoins(arrCoins)
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
            for ( const t of this.grid.createIterator(this.grid) )
                t.placeCoinEven();
        }

        for ( const t of this.grid.createIterator(this.grid) )
            t.originalCoins = t.coins;

        return this;
    }

    jumbleCoins()
    {
        if ( DESIGNING )
            return this;
            
        while ( this.grid.isGridComplete() )
        {
            for ( const t of this.grid.createIterator(this.grid) )
            {
                t.jumbleCoin();
            }
        }
        return this;
    }

    createHTML()
    {
        addStyle();

        // create a grid container; all direct children will become grid items
        const eleWrapper = document.createElement('div');
        // set attributes; "grid-gap" becomes camelCase "gridGrap"
        eleWrapper.id = 'wrapper';

        eleWrapper.style.display = 'grid';
        // @ts-ignore: Property 'gridGap' does not exist on type 'CSSStyleDeclaration'
        eleWrapper.style.gridGap = '0px 0px';   // auto-sets .gridRowGap="0px" and .gridColumnGap="0px"
        // @ts-ignore: Property 'gridTemplateRows' does not exist on type 'CSSStyleDeclaration'
        eleWrapper.style.gridTemplateRows = `${Q}px `.repeat(this.numY);        // can't use SVG repeat(5,100px)
        // @ts-ignore: Property 'gridTemplateColumns' does not exist on type 'CSSStyleDeclaration'
        eleWrapper.style.gridTemplateColumns = `${Q}px `.repeat(this.numX);     // can't use SVG repeat(7,100px)
        eleWrapper.style.backgroundColor = BACKGROUND_COLOR;
        eleWrapper.style.border = `1px solid ${INPROGRESS_COLOR}`;
        eleWrapper.style.width = `${Q * this.numX}px`;
        eleWrapper.style.height = `${Q * this.numY}px`;

        for ( const t of this.grid.createIterator(this.grid) )
        {
            // n.b. the iterator must generate the rows across for the HTML grid to work
            t.div = document.createElement('div');
            eleWrapper.appendChild(t.div);
        }

        document.body.appendChild(eleWrapper);

        return this;
    }

    setGraphics()
    {
        document.title = `Loop 8 Level ${gameState.level}`;

        for ( const t of this.grid.createIterator(this.grid) )
            t.setGraphic();

        return this;
    }

    handleEventKeyDown(event)
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

        if ( event.code == 'KeyU' )
        {
            for ( const t of this.grid.createIterator(this.grid) )
                t.coins = t.originalCoins;
            this.setGraphics();            
        }
    }
}

function main()
{
    const urlParams = Util.getCommandLine();

    DEBUGGING = urlParams.debug ? urlParams.debug : false;
    DESIGNING = urlParams.design ? urlParams.design : false;
    const numX = urlParams.x ? urlParams.x : Math.max(Math.floor(window.innerWidth / Q), 3);
    const numY = urlParams.y ? urlParams.y : Math.max(Math.floor(window.innerHeight / Q), 3);

    const got = new GridOfTiles(numX, numY);
    got.createHTML().placeCoins().jumbleCoins().setGraphics();
}

main();

})();
