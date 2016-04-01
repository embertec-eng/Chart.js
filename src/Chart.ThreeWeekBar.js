(function(){
    "use strict";

    var root = this,
        Chart = root.Chart,
        helpers = Chart.helpers;


    var defaultConfig = {
        //Boolean - Whether the scale should start at zero, or an order of magnitude down from the lowest value
        scaleBeginAtZero : true,

        //Boolean - Whether grid lines are shown across the chart
        scaleShowGridLines : false,

        //Boolean - Whether to show horizontal lines (except X axis)
        scaleShowHorizontalLines: false,

        //Boolean - Whether to show vertical lines (except Y axis)
        scaleShowVerticalLines: false,

        //Boolean - If there is a stroke on each bar
        barShowStroke : false,

        //Number - Spacing between each of the X value sets
        barValueSpacing : 1,

        //Number - Spacing between data sets within X values
        barDatasetSpacing : 1
    };


    Chart.types.Bar.extend({
        name: "ThreeWeekBar",
        defaults : defaultConfig,
        initialize:  function(data){
            //Expose options as a scope variable here so we can access it in the ScaleClass
            var options = this.options;

            this.ScaleClass = Chart.Scale.extend({
                offsetGridLines : true,
                calculateY : function(value) {
                    var baseHeight = this.height - 2 * options.barDatasetSpacing;
                    return this.height - options.barDatasetSpacing - baseHeight * value / (this.max - this.min);
                },
                calculateBarWidth : function(datasetCount){
                    var baseWidth = this.width - (datasetCount+1) * options.barDatasetSpacing - datasetCount * (this.valuesCount-1) * options.barValueSpacing;
                    return baseWidth / (datasetCount * this.valuesCount);
                },
                calculateBarX : function(datasetCount, datasetIndex, barIndex){
                    var barWidth = this.calculateBarWidth(datasetCount),
                        groupWidth = barWidth * this.valuesCount + options.barValueSpacing * (this.valuesCount - 1);
                    return (groupWidth + options.barDatasetSpacing) * datasetIndex + options.barDatasetSpacing + (barWidth + options.barValueSpacing) * barIndex + barWidth/2;
                }
            });

            this.datasets = [];

            //Declare the extension of the default point, to cater for the options passed in to the constructor
            this.BarClass = Chart.Rectangle.extend({
                strokeWidth : this.options.barStrokeWidth,
                showStroke : this.options.barShowStroke,
                ctx : this.chart.ctx
            });

            //Iterate through each of the datasets, and build this into a property of the chart
            helpers.each(data.datasets,function(dataset,datasetIndex){

                var datasetObject = {
                    label : dataset.label || null,
                    fillColor : dataset.fillColor,
                    strokeColor : dataset.strokeColor,
                    bars : []
                };

                this.datasets.push(datasetObject);

                helpers.each(dataset.data,function(dataPoint,index){
                    //Add a new point for each piece of data, passing any required data to draw.
                    datasetObject.bars.push(new this.BarClass({
                        value : dataPoint,
                        label : data.labels[index],
                        datasetLabel: dataset.label,
                        strokeColor : dataset.strokeColor,
                        fillColor : dataset.fillColor,
                        highlightFill : dataset.highlightFill || dataset.fillColor,
                        highlightStroke : dataset.highlightStroke || dataset.strokeColor
                    }));
                },this);

            },this);

            this.buildScale(data.labels);

            this.BarClass.prototype.base = this.scale.height + this.scale.padding;

            this.eachBars(function(bar, index, datasetIndex){
                helpers.extend(bar, {
                    width : this.scale.calculateBarWidth(this.datasets.length),
                    x: this.scale.calculateBarX(this.datasets.length, datasetIndex, index),
                    y: this.scale.calculateY(bar.value)
                });
                bar.save();
            }, this);

            this.render();
        },
        draw : function(ease){
            this.clear();
            var ctx = this.chart.ctx;

            //Draw all the bars for each dataset
            helpers.each(this.datasets,function(dataset,datasetIndex){
                helpers.each(dataset.bars,function(bar,index){
                    if (bar.hasValue()){
                        bar.draw();
                    }
                },this);

            },this);
        }
    });


}).call(this);
