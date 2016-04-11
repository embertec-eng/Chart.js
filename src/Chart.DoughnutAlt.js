(function(){
    "use strict";

    var root = this,
        Chart = root.Chart,
        //Cache a local reference to Chart.helpers
        helpers = Chart.helpers;

    var defaultConfig = {
        //Boolean - Whether we should show a stroke on each segment
        segmentShowStroke : true,

        //String - The colour of each segment stroke
        segmentStrokeColor : "#ffffff",

        //Number - The width of each segment stroke
        segmentStrokeWidth : 2,

        //The percentage of the chart that we cut out of the middle.
        percentageInnerCutout : 50,

        percentageLegendVerticalPadding : 25,
        percentageLegendHorizontalPadding : 15,

        // whether to hide readout text if it goes beyond doughnut area
        hideOutOfRangeReadout : true,

        //Number - Amount of animation steps
        animationSteps : 100,

        //String - Animation easing effect
        animationEasing : "easeOutBounce",

        //Boolean - Whether we animate the rotation of the Doughnut
        animateRotate : false,

        //Boolean - Whether we animate scaling the Doughnut from the centre
        animateScale : false
    };


    Chart.types.Doughnut.extend({
        name: "DoughnutAlt",
        //Providing a defaults will also register the deafults in the chart namespace
        defaults : defaultConfig,
        //Initialize is fired when the chart is initialized - Data is passed in as a parameter
        //Config is automatically merged by the core of Chart.js, and is available at this.options
        initialize:  function(data){
            var that = this;
            //Declare segments as a static property to prevent inheriting across the Chart type prototype
            this.segments = [];
            this.legends = [];
            this.readouts = [];
            //dual line legends
            var tryFontSize = 12;
            this.chart.ctx.font = helpers.fontString(tryFontSize, 'normal', 'sans-serif');
            var longestLegend = helpers.longestText(this.chart.ctx, this.chart.ctx.font, data.map(function(segment) {
                return segment.label;
            }));
            var longestAllowed = (1 - 2 * this.options.percentageLegendHorizontalPadding/100) * this.chart.width/2;
            // minimum of 10px font size for readability
            this.baseFontSize = Math.max(10, Math.round(tryFontSize * longestAllowed / longestLegend));
            this.legendLines = Math.ceil(data.length / 2);
            this.legendLineHeight = (1 + 2 * this.options.percentageLegendVerticalPadding/100) * this.baseFontSize;
            var doughnutAreaHeight = this.chart.height - this.legendLineHeight * this.legendLines;
            this.outerRadius = (helpers.min([this.chart.width, doughnutAreaHeight]) - this.options.segmentStrokeWidth/2)/2;
            this.center = {
                x : this.chart.width/2,
                y : 0.5 * this.baseFontSize + this.outerRadius
            };

            this.SegmentArc = Chart.Arc.extend({
                ctx : this.chart.ctx,
                x : this.center.x,
                y : this.center.y
            });

            this.Legend = Chart.Element.extend({
                ctx : this.chart.ctx,
                draw : function() {
                    var ctx = this.ctx;
                    var circleX = this.x + this.hPadding + this.circleRadius,
                        circleY = this.y + this.vPadding + 0.5 * this.baseFontSize,
                        textX = circleX + this.circleRadius + this.hPadding,
                        textY = circleY;
                    ctx.save();
                    // circle
                    ctx.beginPath();
                    ctx.fillStyle = this.color;
                    ctx.arc(circleX, circleY, this.circleRadius, 0, 2 * Math.PI);
                    ctx.fill();
                    ctx.closePath();
                    // text
                    ctx.beginPath();
                    ctx.textAlign = 'left';
                    ctx.textBaseline = 'middle';
                    ctx.font = helpers.fontString(this.baseFontSize, 'normal', 'sans-serif');
                    ctx.fillStyle = '#000000';
                    ctx.fillText(this.label, textX, textY);
                    ctx.closePath();
                    ctx.restore();
                }
            });

            this.Readout = Chart.Arc.extend({
                ctx : this.chart.ctx,
                x : this.center.x,
                y : this.center.y,
                draw : function() {
                    var ctx = this.ctx;
                    var position = this.tooltipPosition();
                    ctx.save();
                    ctx.beginPath();
                    ctx.textAlign = 'center';
                    ctx.textBaseline = 'middle';
                    ctx.font = helpers.fontString(this.baseFontSize, 'normal', 'sans-serif');
                    ctx.fillStyle = '#000000';
                    if (that.options.hideOutOfRangeReadout) {
                        var m = ctx.measureText(this.text);
                        if (this.inRange(position.x-m.actualBoundingBoxLeft, position.y-m.actualBoundingBoxAscent) &&
                            this.inRange(position.x+m.actualBoundingBoxRight, position.y-m.actualBoundingBoxAscent) &&
                            this.inRange(position.x-m.actualBoundingBoxLeft, position.y+m.actualBoundingBoxDescent) &&
                            this.inRange(position.x+m.actualBoundingBoxRight, position.y+m.actualBoundingBoxDescent)) {
                            ctx.fillText(this.text, position.x, position.y);
                        }
                    } else {
                        ctx.fillText(this.text, position.x, position.y);
                    }
                    ctx.closePath();
                    ctx.restore();
                }
            });

            this.calculateTotal(data);

            data.reduce(function(lastEndAngle, datapoint, index) {
                var segment = that.addData(datapoint, index, lastEndAngle);
                that.segments.push(segment);
                that.readouts.push(that.addReadout(datapoint, index, lastEndAngle));
                that.legends.push(that.addLegend(datapoint, index));
                return segment.endAngle;
            }, Math.PI * 1.5);

            this.render();
        },
        addData : function(segment, atIndex, lastEndAngle){
            return new this.SegmentArc({
                value : segment.value,
                outerRadius : this.outerRadius,
                innerRadius : (this.outerRadius/100) * this.options.percentageInnerCutout,
                fillColor : segment.color,
                highlightColor : segment.highlight || segment.color,
                showStroke : this.options.segmentShowStroke,
                strokeWidth : this.options.segmentStrokeWidth,
                strokeColor : this.options.segmentStrokeColor,
                startAngle : lastEndAngle,
                endAngle : lastEndAngle + this.calculateCircumference(segment.value)
            });
        },
        addLegend : function(datapoint, index) {
            var doughnutBottomY = this.baseFontSize + 2 * this.outerRadius;
            var circleRadius = 0.4 * this.baseFontSize;
            var vPadding = (this.chart.height - doughnutBottomY - this.legendLineHeight * this.legendLines)/2;
            return new this.Legend({
                baseFontSize : this.baseFontSize,
                x : index % 2 ? (0.5*this.chart.width) : 0,
                y : doughnutBottomY + Math.floor(index/2) * this.legendLineHeight,
                circleRadius : circleRadius,
                hPadding : 1.5 * circleRadius,
                vPadding : vPadding,
                color : datapoint.color,
                label : datapoint.label
            });
        },
        addReadout : function(datapoint, index, lastEndAngle) {
            return new this.Readout({
                text : '$' + Math.round(datapoint.value),
                outerRadius : this.outerRadius,
                innerRadius : (this.outerRadius/100) * this.options.percentageInnerCutout,
                baseFontSize : this.baseFontSize,
                startAngle : lastEndAngle,
                endAngle : lastEndAngle + this.calculateCircumference(datapoint.value)
            });
        },
        calculateCircumference : function(value){
            return (Math.PI*2)*(Math.abs(value) / this.total);
        },
        calculateTotal : function(data){
            this.total = data.reduce(function(total, segment) {
                return total + Math.abs(segment.value);
            }, 0);
        },
        draw : function(easeDecimal){
            var ctx = this.chart.ctx;
            this.clear();
            // doughnut
            helpers.each(this.segments,function(segment){
                segment.draw();
            });
            // legend
            helpers.each(this.legends, function(legend) {
                legend.draw();
            });
            // readout
            helpers.each(this.readouts, function(readout) {
                readout.draw();
            });
            // total
            ctx.save();
            var totalText = '$' + Math.round(this.total);
            ctx.font = helpers.fontString(this.baseFontSize, 'bold', 'sans-serif');
            var innerWidth = 2 * this.outerRadius * (this.options.percentageInnerCutout/100) * (1-2*this.options.percentageLegendHorizontalPadding/100);
            // with the dollar character and at least one more digit, text width
            // is always bigger than text height
            var totalFontSize = this.baseFontSize * innerWidth / ctx.measureText(totalText).width;
            ctx.beginPath();
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.font = helpers.fontString(totalFontSize, 'bold', 'sans-serif');
            ctx.fillStyle = '#000000';
            ctx.fillText(totalText, this.center.x, this.center.y);
            ctx.closePath();
            ctx.restore();
        }
    });
}).call(this);