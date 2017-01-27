import { Template } from 'meteor/templating';
import { ReactiveVar } from 'meteor/reactive-var';
import { Session } from 'meteor/session';
import { OHIF } from 'meteor/ohif:core';

Template.caseProgress.onCreated(() => {
    const instance = Template.instance();

    instance.progressPercent = new ReactiveVar();
    instance.progressText = new ReactiveVar();
    instance.isLocked = new ReactiveVar();

    instance.saveData = () => {
        instance.data.measurementApi.storeMeasurements();

        // Clear signaled unsaved changes...
        OHIF.ui.unsavedChanges.clear('viewer.studyViewer.measurements.*');
    };

    instance.unsavedChangesHandler = () => {
        const isNotDisabled = !instance.$('.js-finish-case').hasClass('disabled');
        if (isNotDisabled && instance.progressPercent.get() === 100) {
            instance.saveData();
        }
    };

    // Attach handler for unsaved changes dialog...
    OHIF.ui.unsavedChanges.attachHandler('viewer.studyViewer.measurements', 'save', instance.unsavedChangesHandler);

});

Template.caseProgress.onDestroyed(() => {
    const instance = Template.instance();
    // Remove unsaved changes handler after this view has been destroyed...
    OHIF.ui.unsavedChanges.removeHandler('viewer.studyViewer.measurements', 'save', instance.unsavedChangesHandler);
});

Template.caseProgress.onRendered(() => {
    const instance = Template.instance();

    // Stop here if we have no current timepoint ID (and therefore no defined timepointAPI)
    if (!instance.data.timepointApi) {
        instance.progressPercent.set(100);
        return;
    }

    // Get the current timepoint
    const current = instance.data.timepointApi.current();
    const prior = instance.data.timepointApi.prior();
    if (!current || !prior || !current.timepointId) {
        instance.progressPercent.set(100);
        return;
    }

    instance.isLocked.set(current.isLocked);

    // Retrieve the initial number of targets left to measure at this
    // follow-up. Note that this is done outside of the reactive function
    // below so that new lesions don't change the initial target count.

    const api = instance.data.measurementApi;
    const config = OHIF.measurements.MeasurementApi.getConfiguration();
    const toolGroups = config.measurementTools;

    const toolIds = [];
    toolGroups.forEach(toolGroup => toolGroup.childTools.forEach(tool => {
        const option = 'options.caseProgress.include';
        if (OHIF.utils.ObjectPath.get(tool, option)) {
            toolIds.push(tool.id);
        }
    }));

    const getTimepointFilter = timepointId => ({
        timepointId,
        toolId: { $in: toolIds }
    });

    const getNumMeasurementsAtTimepoint = timepointId => {
        OHIF.log.info('getNumMeasurementsAtTimepoint');
        const filter = getTimepointFilter(timepointId);

        let count = 0;
        toolGroups.forEach(toolGroup => {
            count += api.fetch(toolGroup.id, filter).length;
        });

        return count;
    };

    const getNumRemainingBetweenTimepoints = (currentTimepointId, priorTimepointId) => {
        const currentFilter = getTimepointFilter(currentTimepointId);
        const priorFilter = getTimepointFilter(priorTimepointId);

        let totalRemaining = 0;
        toolGroups.forEach(toolGroup => {
            const toolGroupId = toolGroup.id;
            const numCurrent = api.fetch(toolGroupId, currentFilter).length;
            const numPrior = api.fetch(toolGroupId, priorFilter).length;
            const remaining = Math.max(numPrior - numCurrent, 0);
            totalRemaining += remaining;
        });

        return totalRemaining;
    };

    // If we're currently reviewing a Baseline timepoint, don't do any
    // progress measurement.
    if (current.timepointType === 'baseline') {
        instance.progressPercent.set(100);
    } else {
        // Setup a reactive function to update the progress whenever
        // a measurement is made
        instance.autorun(() => {
            api.changeObserver.depend();
            // Obtain the number of Measurements for which the current Timepoint has
            // no Measurement data
            const totalMeasurements = getNumMeasurementsAtTimepoint(prior.timepointId);
            const numRemainingMeasurements = getNumRemainingBetweenTimepoints(current.timepointId, prior.timepointId);
            const numMeasurementsMade = totalMeasurements - numRemainingMeasurements;

            // Update the Case Progress text with the remaining measurement count
            instance.progressText.set(numRemainingMeasurements);

            // Calculate the Case Progress as a percentage in order to update the
            // radial progress bar
            const progressPercent = Math.min(100, Math.round(100 * numMeasurementsMade / totalMeasurements));
            instance.progressPercent.set(progressPercent);
        });
    }
});

Template.caseProgress.helpers({
    progressPercent() {
        return Template.instance().progressPercent.get();
    },

    progressText() {
        return Template.instance().progressText.get();
    },

    isLocked() {
        return Template.instance().isLocked.get();
    },

    progressComplete() {
        const instance = Template.instance();
        if (!instance.data.timepointApi) {
            return true;
        }

        const progressPercent = instance.progressPercent.get();
        return progressPercent === 100;
    },

    isFinishDisabled() {
        // Run this computation every time any measurement / timepoint suffer changes
        Session.get('LayoutManagerUpdated');

        return OHIF.ui.unsavedChanges.probe('viewer.*') === 0;
    }
});

Template.caseProgress.events({
    'click .js-finish-case'(event, instance) {
        const $this = $(event.currentTarget);

        // Stop here if the tool is disabled
        if ($this.hasClass('disabled')) {
            return;
        }

        instance.saveData();
        switchToTab('studylistTab');

    }
});
