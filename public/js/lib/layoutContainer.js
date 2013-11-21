/**
 *  layout-container (http://github.com/opentok/layout-container)
 *  
 *  Automatic layout of video elements (publisher and subscriber) minimising white-space for the OpenTok on WebRTC API.
 *
 *  @Author: Adam Ullman (http://github.com/aullman)
**/

(function() {
    var positionElement = function positionElement(elem, x, y, width, height, animate) {
        var targetPosition = {
            left: x + "px",
            top: y + "px",
            width: width + "px",
            height: height + "px"
        };
        if (animate && $) {
            $(elem).stop();
            $(elem).animate(targetPosition, animate.duration || 200, animate.easing || "swing", animate.complete);
        } else {
            OT.$.css(elem, targetPosition);
        }
        
        var sub = elem.querySelector(".OT_root");
        if (sub) {
            // If this is the parent of a subscriber or publisher then we need
            // to force the mutation observer on the publisher or subscriber to
            // trigger to get it to fix it's layout
            var oldWidth = sub.style.width;
            sub.style.width = width + "px";
            // sub.style.height = height + "px";
            sub.style.width = oldWidth || "";
        }
    };
    
    var arrange = function arrange(children, Width, Height, offsetLeft, offsetTop, fixedRatio, minRatio, maxRatio, animate) {
        var count = children.length,
            availableRatio = Height / Width,
            vidRatio;
    
        var tryVidRatio = function tryVidRatio(vidRatio) {
            var minDiff,
                targetCols,
                targetRows;
            for (var i=1; i <= count; i++) {
                var cols = i;
                var rows = Math.ceil(count / cols);
                var ratio = rows/cols * vidRatio;
                var ratio_diff = Math.abs(availableRatio - ratio);
                if (minDiff == undefined || (ratio_diff < minDiff)) {
                    minDiff = ratio_diff;
                    targetCols = cols;
                    targetRows = rows;
                }
            };
            return {
                minDiff: minDiff,
                targetCols: targetCols,
                targetRows: targetRows,
                ratio: vidRatio
            };
        };
    
        if (!fixedRatio) {
            // Try all video ratios between minRatio (landscape) and maxRatio (portrait)
            // Just a brute force approach to figuring out the best ratio
            var incr = minRatio < maxRatio ? (maxRatio - minRatio) / 20.0 : 0,
                testRatio,
                i;
            for (i=minRatio; i <= maxRatio; i=OT.$.roundFloat(i+incr, 5)) {
                testRatio = tryVidRatio(i);
                if (!vidRatio || testRatio.minDiff < vidRatio.minDiff) vidRatio = testRatio;
            }
        } else {
            // Use the ratio of the first video element we find
            var video = children[0].querySelector("video");
            if (video) vidRatio = tryVidRatio(video.videoHeight/video.videoWidth);
            else vidRatio = tryVidRatio(3/4);   // Use the default video ratio
        }

        if ((vidRatio.targetRows/vidRatio.targetCols) * vidRatio.ratio > availableRatio) {
            targetHeight = Math.floor( Height/vidRatio.targetRows );
            targetWidth = Math.floor( targetHeight/vidRatio.ratio );
        } else {
            targetWidth = Math.floor( Width/vidRatio.targetCols );
            targetHeight = Math.floor( targetWidth*vidRatio.ratio );
        }

        var spacesInLastRow = (vidRatio.targetRows * vidRatio.targetCols) - count,
            lastRowMargin = (spacesInLastRow * targetWidth / 2),
            lastRowIndex = (vidRatio.targetRows - 1) * vidRatio.targetCols,
            firstRowMarginTop = ((Height - (vidRatio.targetRows * targetHeight)) / 2),
            firstColMarginLeft = ((Width - (vidRatio.targetCols * targetWidth)) / 2);

        // Loop through each stream in the container and place it inside
        var x = 0,
            y = 0;
        for (i=0; i < children.length; i++) {
            var elem = children[i];
            if (i % vidRatio.targetCols == 0) {
                // We are the first element of the row
                x = firstColMarginLeft;
                if (i == lastRowIndex) x += lastRowMargin;
                y += i == 0 ? firstRowMarginTop : targetHeight;
            } else {
                x += targetWidth;
            }

            OT.$.css(elem, "position", "absolute");
            var actualWidth = targetWidth - parseInt(OT.$.css(elem, "paddingLeft"), 10) -
                            parseInt(OT.$.css(elem, "paddingRight"), 10) -
                            parseInt(OT.$.css(elem, "marginLeft"), 10) - 
                            parseInt(OT.$.css(elem, "marginRight"), 10) -
                            parseInt(OT.$.css(elem, "borderLeft"), 10) -
                            parseInt(OT.$.css(elem, "borderRight"), 10);

             var actualHeight = targetHeight - parseInt(OT.$.css(elem, "paddingTop"), 10) -
                            parseInt(OT.$.css(elem, "paddingBottom"), 10) -
                            parseInt(OT.$.css(elem, "marginTop"), 10) - 
                            parseInt(OT.$.css(elem, "marginBottom"), 10) -
                            parseInt(OT.$.css(elem, "borderTop"), 10) - 
                            parseInt(OT.$.css(elem, "borderBottom"), 10);

            positionElement(elem, x+offsetLeft, y+offsetTop, actualWidth, actualHeight, animate);
        }
    };
    
    var layout = function layout(container, opts, fixedRatio) {
        if (OT.$.css(container, "display") === "none") {
            return;
        }
        var id = container.getAttribute("id");
        if (!id) {
            id = "OT_" + TB.$.uuid();
            container.setAttribute("id", id);
        }
        
        var Height = parseInt(OT.$.height(container), 10)  - 
                    parseInt(OT.$.css(container, "borderTop"), 10) - 
                    parseInt(OT.$.css(container, "borderBottom"), 10),
            Width = parseInt(OT.$.width(container), 10) -
                    parseInt(OT.$.css(container, "borderLeft"), 10) -
                    parseInt(OT.$.css(container, "borderRight"), 10),
            availableRatio = Height/Width,
            offsetLeft = 0,
            offsetTop = 0;
        
        var bigOnes = container.querySelectorAll("#" + id + ">." + opts.bigClass),
            smallOnes = container.querySelectorAll("#" + id + ">*:not(." + opts.bigClass + ")");
        
        if (bigOnes.length > 0 && smallOnes.length > 0) {
            var bigVideo = bigOnes[0].querySelector("video"),
                bigRatio = bigVideo.videoHeight / bigVideo.videoWidth,
                bigWidth, bigHeight;
            
            if (availableRatio > bigRatio) {
                // We are tall, going to take up the whole width and arrange small guys at the bottom
                bigWidth = Width;
                bigHeight = Math.min(Math.floor(Height * opts.bigPercentage), Width * bigRatio);
                offsetTop = bigHeight;
            } else {
                // We are wide, going to take up the whole height and arrange the small guys on the right
                bigHeight = Height;
                bigWidth = Math.min(Width * opts.bigPercentage, Math.floor(bigHeight / bigRatio));
                offsetLeft = bigWidth;
            }
            arrange(bigOnes, bigWidth, bigHeight, 0, 0, opts.bigFixedRatio, opts.bigMinRatio, opts.bigMaxRatio, opts.animate);
        } else if (bigOnes.length > 0 && smallOnes.length === 0) {
            // We only have one bigOne just center it
            arrange(bigOnes, Width, Height, 0, 0, opts.bigFixedRatio, opts.bigMinRatio, opts.bigMaxRatio, opts.animate);
        }
        
        // Arrange the small guys
        // 
        arrange(smallOnes, Width - offsetLeft, Height - offsetTop, offsetLeft, offsetTop, opts.fixedRatio, opts.minRatio, opts.maxRatio, opts.animate);
     };
     
     if (!TB) {
         throw new Error("You must include the OpenTok for WebRTC JS API before the layout-container library");
     }
     TB.initLayoutContainer = function(container, opts) {
         opts = OT.$.defaults(opts || {}, {maxRatio: 3/2, minRatio: 9/16, fixedRatio: false, animate: false, bigClass: "OT_big", bigPercentage: 0.8, bigFixedRatio: false, bigMaxRatio: 3/2, bigMinRatio: 9/16});
         container = typeof(container) == "string" ? OT.$(container) : container;
        
         OT.onLoad(function() {
             layout(container, opts);
         });
        
         return {
             layout: layout.bind(null, container, opts)
         };
     };
})();