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
		barValueSpacing : 2,

		//Number - Spacing between data sets within X values
		barDatasetSpacing : 2
	};


	Chart.types.Bar.extend({
		name: "ThreeWeekBar",
		defaults : defaultConfig,
		initialize:  function(data){
			//Expose options as a scope variable here so we can access it in the ScaleClass
			var options = this.options;
            this.title = data.title;

            this.ScaleClass = Chart.Scale.extend({
				offsetGridLines : true,
				calculateBarX : function(datasetCount, datasetIndex, barIndex){
                    var barWidth = this.calculateBarWidth(datasetCount),
                        groupWidth = this.calculateBarGroupWidth(datasetCount),
                        retval = (groupWidth + options.barDatasetSpacing) * datasetIndex + (barWidth + options.barValueSpacing) * barIndex;

                    return this.xScalePaddingLeft + retval;
				},
				calculateBaseWidth : function(){
					return (this.calculateX(1) - this.calculateX(0)) - (2*options.barDatasetSpacing);
				},
				calculateBarWidth : function(datasetCount){
					//The padding between datasets is to the right of each bar, providing that there are more than 1 dataset
					var baseWidth = this.calculateBaseWidth() - ((datasetCount - 1) * options.barValueSpacing);

					return (baseWidth / datasetCount);
				},
                calculateBarGroupWidth: function(datasetCount){
                    var barWidth = this.calculateBarWidth(datasetCount);
                    return barWidth * this.valuesCount + options.barValueSpacing * (this.valuesCount - 1);
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

			this.BarClass.prototype.base = this.scale.endPoint;

			this.eachBars(function(bar, index, datasetIndex){
				helpers.extend(bar, {
					width : this.scale.calculateBarWidth(this.datasets.length),
					x: this.scale.calculateBarX(this.datasets.length, datasetIndex, index),
					y: this.scale.endPoint
				});
				bar.save();
			}, this);

			this.render();
		},
		draw : function(ease){
			var easingDecimal = ease || 1;
            this.clear();

			var ctx = this.chart.ctx;

            //Draw the global title
            if (this.title) {
                ctx.fillStyle = this.scale.textColor;
                ctx.font = this.font;
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                var textX = ctx.canvas.width/2;
                var textY = this.scale.fontSize;
                ctx.fillText(this.title, textX, textY);
            }
			//Draw all the bars for each dataset
			helpers.each(this.datasets,function(dataset,datasetIndex){
                // Draw the dataset label
                ctx.fillStyle = this.scale.textColor;
                ctx.font = this.font;
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                var groupWidth = this.scale.calculateBarGroupWidth(this.datasets.length);
                var textAlignX = this.scale.xScalePaddingLeft + groupWidth * datasetIndex + this.options.barDatasetSpacing * datasetIndex + groupWidth * 0.5;
                var textY = this.scale.calculateY(0) + this.scale.fontSize;
                ctx.fillText(dataset.label, textAlignX, textY, groupWidth);

				helpers.each(dataset.bars,function(bar,index){
					if (bar.hasValue()){
						bar.base = this.scale.endPoint;
                        var barX = this.scale.calculateBarX(this.datasets.length, datasetIndex, index);
                        var barY = this.scale.calculateY(bar.value);
                        var width = this.scale.calculateBarWidth(this.datasets.length);
						//Transition then draw
						bar.transition({
							x : this.scale.calculateBarX(this.datasets.length, datasetIndex, index),
							y : this.scale.calculateY(bar.value),
							width : this.scale.calculateBarWidth(this.datasets.length)
						}, easingDecimal).draw();
					}
				},this);

			},this);
		}
	});


}).call(this);
