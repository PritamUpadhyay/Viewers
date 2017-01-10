import { Meteor } from 'meteor/meteor';
import { cornerstoneWADOImageLoader } from 'meteor/ohif:cornerstone';

Meteor.startup(function() {
	const maxWebWorkers = Math.max(navigator.hardwareConcurrency - 1, 1);
    const config = {
	    maxWebWorkers: maxWebWorkers,	
    	startWebWorkersOnDemand: true,
        webWorkerPath : Meteor.absoluteUrl('packages/ohif_cornerstone/public/js/cornerstoneWADOImageLoaderWebWorker.js'),
        taskConfiguration: {
            'decodeTask' : {
		        loadCodecsOnStartup : true,
		        initializeCodecsOnStartup: false,
                codecsPath: Meteor.absoluteUrl('packages/ohif_cornerstone/public/js/cornerstoneWADOImageLoaderCodecs.js'),
                usePDFJS: false
            }
        }
    };

    cornerstoneWADOImageLoader.webWorkerManager.initialize(config);
});