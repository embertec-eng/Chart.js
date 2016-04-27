(function(){
    "use strict";

    var root = this,
        Chart = root.Chart,
        helpers = Chart.helpers;

    var defaultConfig = {
        //Boolean - Whether we should show a stroke on each segment
        segmentShowStroke : false,

        //The percentage of the chart that we cut out of the middle against the outer circle
        percentageInnerCutout : 75,

        //The percentage of the pulse's inner area against the outer circle
        percentagePulseInner : 120,

        //The percentage of the pulse's green halo's outer boundary against the outer circle
        percentageHaloOuter : 140,

        //The percentage of the pulse's out boundary against outer circle
        percentageOuter : 150,

        //The percentage of the border radius against outer length
        percentageRadius : 25,

        //The percentage of the text tick against outer circle radius
        percentageTickLength : 35,
        tickStrokeWidth : 1,
        //The percentage of the tick end circle radius against outer circle radius
        percentageTickEndCircleRadius : 5,

        percentageDotRadius : 5,

        percentageNotBad : 125,

        colorGood : '#92d400',
        colorNotBad : '#e89e0c',
        colorBad : '#ff0000',
        colorBorder : '#000000',
        colorBelow : '#666666'
    };

    Chart.types.Doughnut.extend({
        name: "PulseForecast",
        defaults : defaultConfig,
        initialize:  function(data){
            var that = this;
            // We're only interested in the first three array elements
            var haloColor =  (data.forecast > data.budget * this.options.percentageNotBad/100) ? this.options.colorBad : (data.forecast > data.budget ? this.options.colorNotBad : this.options.colorGood);
            var texts = {
                todate: 'To date',
                budget: 'Budget'
            };
            //Declare segments as a static property to prevent inheriting across the Chart type prototype
            this.segments = [];
            this.outerRadius = (helpers.min([this.chart.width,this.chart.height])*100/this.options.percentageOuter)/2;
            this.center = {
                x : this.chart.width/2,
                y : this.chart.height/2
            };

            this.SegmentArc = Chart.Arc.extend({
                ctx : this.chart.ctx,
                x : this.center.x,
                y : this.center.y
            });

            this.DotArc = Chart.Arc.extend({
                ctx : this.chart.ctx,
                x : this.center.x,
                y : this.center.y,
                radius : this.outerRadius * (this.options.percentageInnerCutout + (100-this.options.percentageInnerCutout)/2)/100,
                dotRadius : Math.max(2, this.outerRadius * this.options.percentageDotRadius/100),
                draw : function() {
                    var ctx = this.ctx;
                    var endAngle = this.endAngle < this.startAngle ? this.endAngle + Math.PI * 2 : this.endAngle;
                    var dotCircumference = 2 * Math.asin(this.dotRadius/this.radius);
                    // dot space ratio is 1:1
                    var step = 2 * dotCircumference;
                    var currentAngle = this.startAngle + 0.5 * dotCircumference;
                    ctx.save();
                    function colorFinder(curr) {
                        return function(color, thr) {
                            if (thr.startAngle < curr && curr <= thr.endAngle) {
                                color = thr.color;
                            }
                            return color;
                        };
                    }
                    // draw at least one dot
                    do {
                        ctx.beginPath();
                        ctx.strokeWidth = 0;
                        ctx.fillStyle = this.fillColors.reduce(colorFinder(currentAngle), this.fillColors[0].color);
                        ctx.arc(
                            this.x + Math.cos(currentAngle) * this.radius,
                            this.y + Math.sin(currentAngle) * this.radius,
                            this.dotRadius,
                            0,
                            Math.PI * 2
                        );
                        ctx.fill();
                        ctx.closePath();
                        currentAngle += step;
                        // enough room to draw one dot
                    } while (currentAngle + 0.5 * dotCircumference <= endAngle);
                    ctx.restore();
                }
            });

            this.RoundedRectangle = Chart.Element.extend({
                ctx: this.chart.ctx,
                draw: function() {
                    var ctx = this.ctx;
                    ctx.save();
                    ctx.beginPath();
                    ctx.strokeWidth = 0;
                    ctx.fillStyle = this.fillColor;
                    ctx.moveTo(this.x + this.radius, this.y);
                    ctx.lineTo(this.x + this.width - this.radius, this.y);
                    ctx.quadraticCurveTo(this.x + this.width, this.y, this.x + this.width, this.y + this.radius);
                    ctx.lineTo(this.x + this.width, this.y + this.height - this.radius);
                    ctx.quadraticCurveTo(this.x + this.width, this.y + this.height, this.x + this.width - this.radius, this.y + this.height);
                    ctx.lineTo(this.x + this.radius, this.y + this.height);
                    ctx.quadraticCurveTo(this.x, this.y + this.height, this.x, this.y + this.height - this.radius);
                    ctx.lineTo(this.x, this.y + this.radius);
                    ctx.quadraticCurveTo(this.x, this.y, this.x + this.radius, this.y);
                    ctx.fill();
                    ctx.closePath();
                    ctx.restore();
                }
            });

            this.OuterTick = Chart.Element.extend({
                ctx: this.chart.ctx,
                draw: function() {
                    var ctx = this.ctx;
                    var valueText = '$' + Math.round(this.value);
                    var outX = this.center.x - this.outerRadius * this.cosv,
                        outY = this.center.y - this.outerRadius * this.sinv,
                        inX = this.center.x - this.innerRadius * this.cosv,
                        inY = this.center.y - this.innerRadius * this.sinv,
                        hTickY = ((outX < this.center.x && this.direction === 'right') || (outX > this.center.x && this.direction === 'left')) ? Math.min(outY, this.arcTopY-2) : outY,
                        // slightly smaller font than the inner circle tick
                        sizeFactor = 2,
                        // avoid touching tick end circle with texts
                        vPadding = Math.max(0.25 * this.baseFontSize, this.tickEndRadius),
                        hPadding = 0.5 * sizeFactor * this.baseFontSize,
                        descFont = helpers.fontString(this.baseFontSize, 'normal', 'sans-serif'),
                        valueFont = helpers.fontString(sizeFactor * this.baseFontSize, 'bold', 'sans-serif'),
                        maxTextWidth,
                        tickEndCircleX;
                    ctx.save();
                    // measure the widest text to calculate tickEndCirlceX
                    ctx.font = descFont;
                    maxTextWidth = ctx.measureText(this.text).width;
                    ctx.font = valueFont;
                    maxTextWidth = Math.max(maxTextWidth, ctx.measureText(valueText).width);
                    maxTextWidth += hPadding;
                    tickEndCircleX = this.pulseEdgeX + (this.direction === 'left' ? -1 : 1) * maxTextWidth;
                    // tick
                    ctx.beginPath();
                    ctx.strokeWidth = this.strokeWidth;
                    ctx.lineJoin = 'miter';
                    ctx.strokeStyle = this.color;
                    // angular tick
                    ctx.moveTo(inX, inY);
                    ctx.lineTo(outX, outY);
                    // horizontal tick
                    ctx.lineTo(outX, hTickY); // this could well be the same point as outX,outY
                    ctx.lineTo(tickEndCircleX, hTickY);
                    ctx.stroke();
                    ctx.closePath();
                    // tick circle
                    ctx.beginPath();
                    ctx.fillStyle = this.color;
                    ctx.arc(tickEndCircleX, hTickY, this.tickEndRadius, 0, 2 * Math.PI);
                    ctx.fill();
                    ctx.closePath();
                    //text
                    ctx.beginPath();
                    ctx.font = descFont;
                    ctx.textAlign = this.direction;
                    ctx.textBaseline = 'bottom';
                    ctx.fillStyle = '#000000';
                    ctx.fillText(this.text, tickEndCircleX, hTickY - vPadding);
                    ctx.closePath();
                    // value
                    ctx.beginPath();
                    ctx.font = valueFont;
                    ctx.textAlign = this.direction;
                    ctx.textBaseline = 'top';
                    ctx.fillStyle = '#000000';
                    ctx.fillText(valueText, tickEndCircleX, hTickY + vPadding);
                    ctx.closePath();
                    ctx.restore();
                }
            });

            this.InnerTick = Chart.Element.extend({
                ctx: this.chart.ctx,
                draw: function() {
                    var ctx = this.ctx;
                    var outX = this.center.x - this.outerRadius * this.cosv,
                        outY = this.center.y - this.outerRadius * this.sinv,
                        inX = this.center.x - this.innerRadius * this.cosv,
                        inY = this.center.y - this.innerRadius * this.sinv,
                        vPadding = 0.25 * this.baseFontSize,
                        valueLineFontSize = 2.2 * this.baseFontSize;
                    ctx.save();
                    // tick
                    ctx.beginPath();
                    ctx.strokeWidth = this.strokeWidth;
                    ctx.lineJoin = 'miter';
                    ctx.strokeStyle = this.color;
                    ctx.moveTo(outX, outY);
                    ctx.lineTo(inX, inY);
                    ctx.stroke();
                    ctx.closePath();
                    // tick circle
                    ctx.beginPath();
                    ctx.fillStyle = this.color;
                    ctx.arc(inX, inY, this.tickEndRadius, 0, 2 * Math.PI);
                    ctx.fill();
                    ctx.closePath();
                    // forecast text
                    ctx.beginPath();
                    ctx.font = helpers.fontString(this.baseFontSize, 'normal', 'sans-serif');
                    ctx.textAlign = 'center';
                    ctx.textBaseline = 'bottom';
                    ctx.fillStyle = '#000000';
                    ctx.fillText('Forecast', this.center.x, this.center.y - this.baseFontSize - vPadding);
                    ctx.fillText('for this period', this.center.x, this.center.y - vPadding);
                    ctx.closePath();
                    // forecast value
                    ctx.beginPath();
                    ctx.font = helpers.fontString(valueLineFontSize, 'bold', 'sans-serif');
                    ctx.textAlign = 'center';
                    ctx.textBaseline = 'top';
                    ctx.fillStyle = '#000000';
                    ctx.fillText('$' + Math.round(this.value), this.center.x, this.center.y + vPadding);
                    ctx.closePath();
                    ctx.restore();
                }
            });


            this.calculateTotal(data);

            var thresholds = [{
                threshold : 0
            }, {
                threshold : 1,
                color : this.options.colorGood
            }, {
                threshold : this.options.percentageNotBad/100,
                color : this.options.colorNotBad
            }, {
                threshold : this.total / data.budget,
                color : this.options.colorBad
            }];
            this.greySeg = this.addData({
                value : this.total,
                color : this.options.colorBelow
            }, 3, thresholds.slice(1).reduce(function(lastValue, thr, index) {
                if (data.todate > data.budget * thresholds[index].threshold) {
                    var newValue = Math.min(data.todate, data.budget * thr.threshold);
                    that.segments.push(that.addData({
                        value : newValue,
                        color : thr.color
                    }, index, lastValue));
                    lastValue = newValue;
                }
                return lastValue;
            }, 0));
            this.greySeg.endAngle = Math.PI;

            if (data.forecast > data.todate) {
                this.dot = new this.DotArc({
                    value : data.forecast,
                    startAngle : Math.PI + this.calculateCircumference(data.todate),
                    endAngle : Math.PI + this.calculateCircumference(data.forecast),
                    fillColors : thresholds.slice(1).map(function(thr, index) {
                        return {
                            startAngle : Math.PI + that.calculateCircumference(data.budget * thresholds[index].threshold),
                            endAngle : Math.PI + that.calculateCircumference(data.budget * thr.threshold),
                            color : thr.color
                        };
                    })
                });
            }

            this.roundedRectangles = [{
                pct: this.options.percentageOuter,
                color: this.options.colorBorder
            },{
                pct: this.options.percentageHaloOuter,
                color: haloColor
            }, {
                pct: this.options.percentagePulseInner,
                color: this.options.colorBorder
            }].map(function(rr) {
                var rrRadius = this.outerRadius * rr.pct / 100;
                return new this.RoundedRectangle({
                    x : this.center.x - rrRadius,
                    y : this.center.y - rrRadius,
                    width : 2 * rrRadius,
                    height : 2 * rrRadius,
                    radius : 2 * rrRadius * this.options.percentageRadius / 100,
                    fillColor : rr.color
                });
            }, this);

            this.ticks = [];
            this.ticks.push(new this.InnerTick({
                value: data.forecast,
                color : this.options.colorBelow,
                baseFontSize : Math.floor(this.outerRadius/6),
                strokeWidth : this.options.tickStrokeWidth,
                outerRadius : this.outerRadius,
                innerRadius : this.outerRadius * (1 - this.options.percentageTickLength / 100),
                center : this.center,
                tickEndRadius : Math.max(this.options.percentageTickEndCircleRadius * this.outerRadius / 100, 1),
                sinv : Math.sin((data.forecast/this.total) * 2 * Math.PI),
                cosv : Math.cos((data.forecast/this.total) * 2 * Math.PI)
            }));

            Object.keys(data).filter(function(key) {
                return ['todate', 'budget'].indexOf(key.toLowerCase()) >= 0;
            }).sort(function(a, b) {
                return data[a] - data[b];
            }).forEach(function(key, index) {
                var directions = ['left', 'right'];
                var pulseEdgeX = this.center.x + (index ? 1 : -1) * this.outerRadius * this.options.percentageOuter / 100;
                this.ticks.push(new this.OuterTick({
                    direction : directions[index],
                    value: data[key],
                    text: texts[key],
                    color : this.options.colorBelow,
                    baseFontSize : Math.floor(this.outerRadius/6),
                    strokeWidth : this.options.tickStrokeWidth,
                    outerRadius : this.outerRadius * (this.options.percentageInnerCutout + this.options.percentageTickLength)/100,
                    innerRadius : this.outerRadius * this.options.percentageInnerCutout / 100,
                    center : this.center,
                    tickEndRadius : Math.max(this.options.percentageTickEndCircleRadius * this.outerRadius / 100, 1),
                    sinv : Math.sin((data[key]/this.total) * 2 * Math.PI),
                    cosv : Math.cos((data[key]/this.total) * 2 * Math.PI),
                    arcTopY : this.center.y - this.outerRadius,
                    pulseEdgeX : pulseEdgeX
                }));
            }, this);

            this.render();
        },
        addData : function(segment, atIndex, lastValue){
            return new this.SegmentArc({
                value : segment.value - lastValue,
                outerRadius : this.outerRadius,
                innerRadius : (this.outerRadius/100) * this.options.percentageInnerCutout,
                fillColor : segment.color,
                highlightColor : segment.highlight || segment.color,
                showStroke : this.options.segmentShowStroke,
                strokeWidth : 0,
                strokeColor : segment.color,
                startAngle : Math.PI + this.calculateCircumference(lastValue),
                endAngle : Math.PI + this.calculateCircumference(segment.value),
                label : segment.label
            });
        },
        calculateTotal : function(values){
            this.total = helpers.max(Object.keys(values).map(function(key) {
                return Math.abs(values[key]);
            })) * 2;
        },
        draw : function(easeDecimal){
            var ctx = this.chart.ctx;
            this.clear();

            // Pulse body
            helpers.each(this.roundedRectangles, function(rr) {
                rr.draw();
            }, this);

            // Cut the forecast circle area
            ctx.save();
            ctx.beginPath();
            ctx.strokeWidth = 0;
            ctx.arc(this.center.x, this.center.y, this.outerRadius-0.5, 0, 2 * Math.PI);
            ctx.clip();
            ctx.clearRect(this.center.x - this.outerRadius, this.center.y - this.outerRadius, this.outerRadius * 2, this.outerRadius * 2);
            ctx.closePath();
            ctx.restore();

            this.greySeg.draw();

            // Forecast doughnut
            helpers.each(this.segments, function(segment){
                segment.draw();
            });

            // Tick and text
            helpers.each(this.ticks, function(tick) {
                tick.draw();
            });

            if (this.dot) {
                // Dots on the top to avoid tick stroke over dots
                this.dot.draw();
            }
        }
    });
}).call(this);

