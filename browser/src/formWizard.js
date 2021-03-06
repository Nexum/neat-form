"use strict";

let googleLoaded = !!window.google && !!window.google.maps;

function getElementOffset(element) {
    if (!element) {
        return {y: 0, x: 0};
    }
    let de = document.documentElement;
    let box = element.getBoundingClientRect();
    let top = box.top + window.pageYOffset - de.clientTop;
    let left = box.left + window.pageXOffset - de.clientLeft;
    return {y: top, x: left};
}

module.exports = function (neatFormModule) {

    neatFormModule.directive("neatFormWizard", [
        function () {
            return {
                restrict: "E",
                template: require(neatFormModule.templateRoot + "neatFormWizard.html"),
                scope: {
                    id: "=",
                    form: "=",
                    isSubForm: "="
                },
                controller: "neatFormWizardCtrl"
            };
        }
    ]);

    neatFormModule.controller("neatFormWizardCtrl", [
        "$scope",
        "$rootScope",
        "$q",
        "$sce",
        "$anchorScroll",
        "$document",
        "$timeout",
        "neatApi",
        "angularLoad",
        function ($scope, $rootScope, $q, $sce, $anchorScroll, $document, $timeout, neatApi, angularLoad) {
            $scope.connectedId = $scope.id;
            $scope.activeTab = 0;
            $scope.activeTabRef = null;
            $scope.maximumTabIndex = 0;
            $scope.currentTabValid = true;

            $scope.goToTab = function (index) {
                $scope.activeTabRef = null;

                function handleResponseValidate() {
                    let currentGroups = [];

                    for (let i = 0; i < $scope.config.groups.length; i++) {
                        let group = $scope.config.groups[i];

                        if (group.groupWizardTabIndex === $scope.activeTab) {
                            if (!$scope.activeTabRef) {
                                $scope.activeTabRef = group;
                            }
                            currentGroups.push(group.hasError);
                        }
                    }

                    if (currentGroups.indexOf(true) === -1) {
                        $scope.currentTabValid = true;
                        $scope.activeTab = index;
                    } else {
                        $scope.currentTabValid = false;
                    }

                    let pos = getElementOffset(document.querySelector("neat-form-wizard"));
                    window.scrollTo(0, pos.y);
                }

                $scope.validate().then(handleResponseValidate, handleResponseValidate);
            }

            $scope.recalcGroupIndexes = () => {
                let wizardIndex = 0;
                $scope.activeTabRef = null;
                if ($scope.config && $scope.config) {
                    for (let i = 0; i < $scope.config.groups.length; i++) {
                        let group = $scope.config.groups[i];
                        if (group.label && i !== 0) {
                            wizardIndex++;
                        }
                        $scope.maximumTabIndex = wizardIndex;
                        group.groupWizardTabIndex = wizardIndex;

                        if (group.groupWizardTabIndex === $scope.activeTab) {
                            if (!$scope.activeTabRef) {
                                $scope.activeTabRef = group;
                            }
                        }
                    }
                }
            }

            $scope.reset = function () {
                if ($scope.loading) {
                    return;
                }

                $scope.loading = true;
                neatApi.form({
                    form: $scope.form,
                    _id: $scope.connectedId
                }, (config) => {
                    $scope.loading = false;
                    $scope.fields = [];
                    $scope.config = $scope.processConfig(config);
                    $scope.error = null;
                    $scope.recalcGroupIndexes();

                    if ($scope.config && $scope.config.renderOptions && $scope.config.renderOptions.infoMessage) {
                        if (typeof $scope.config.renderOptions.infoMessage === "string") {
                            $scope.config.renderOptions.infoMessage = $sce.trustAsHtml($scope.config.renderOptions.infoMessage);
                        }
                    }

                    if ($scope.config && $scope.config.renderOptions && $scope.config.renderOptions.googleMapsKey && !googleLoaded) {
                        googleLoaded = true;
                        let googleScriptSource = "https://maps.googleapis.com/maps/api/js?key=" + $scope.config.renderOptions.googleMapsKey + "&libraries=places,maps";
                        angularLoad.loadScript(googleScriptSource).then(() => {
                            $rootScope.googleReady = true;
                            $rootScope.$emit("googleLoaded");
                        });
                    }
                });
            };

            $scope.subforms = [];
            $scope.$emit("neat-form-register", $scope);
            $scope.$on("neat-form-register", function (event, subformscope) {
                $scope.subforms.push(subformscope);
            });
            $scope.fields = {};
            $rootScope.$on("neat-form-field-register", function (event, id, fieldscope) {
                fieldscope.setFormScope($scope);
                // if it already exists, ignore its a duplicate, the first one counts!
                if (!$scope.fields[id]) {
                    $scope.fields[id] = fieldscope;
                }
            });

            $scope.getFieldById = function (id) {
                return $scope.fields[id] || null;
            };

            $scope.reset();

            $scope.getValues = function (sectionsOrFields, values) {
                values = values || {};

                if (sectionsOrFields.type === "Subform") {
                    values[sectionsOrFields.id] = $scope.getValues(sectionsOrFields.value);
                } else if (sectionsOrFields instanceof Array) {
                    for (let i = 0; i < sectionsOrFields.length; i++) {
                        let field = sectionsOrFields[i];
                        $scope.getValues(field, values);
                    }
                } else if (sectionsOrFields.fields) {
                    for (let i = 0; i < sectionsOrFields.fields.length; i++) {
                        let field = sectionsOrFields.fields[i];
                        $scope.getValues(field, values);
                    }
                } else if (sectionsOrFields.groups) {
                    for (let i = 0; i < sectionsOrFields.groups.length; i++) {
                        let field = sectionsOrFields.groups[i];
                        $scope.getValues(field, values);
                    }
                } else {
                    if (values[sectionsOrFields.id]) {
                        console.log(2, sectionsOrFields);
                    }
                    values[sectionsOrFields.id] = sectionsOrFields.value;
                }

                return values;
            };

            $scope.submit = function () {
                if ($scope.loading) {
                    return $scope.submitProm;
                }

                $scope.submitProm = $q((resolve, reject) => {
                    let toSave = [];
                    if ($scope.subforms && $scope.subforms.length) {
                        for (let i = 0; i < $scope.subforms.length; i++) {
                            toSave.push($scope.subforms[i]);
                        }
                    }

                    return $scope.saveAllSubforms(toSave).then(() => {

                        let values = $scope.getValues($scope.config);

                        return neatApi.formSubmit({
                            _id: $scope.connectedId,
                            data: values,
                            form: $scope.form
                        }, (config) => {
                            $scope.loading = false;
                            $scope.fields = [];
                            $scope.config = $scope.processConfig(config);
                            $scope.recalcGroupIndexes();

                            // set id after create in case we want to just keep the form open (html decides)
                            if ($scope.config.connectedId) {
                                $scope.connectedId = $scope.config.connectedId;
                            }

                            if ($scope.config.renderOptions && $scope.config.renderOptions.successMessage) {
                                $scope.config.renderOptions.successMessage = $sce.trustAsHtml($scope.config.renderOptions.successMessage);
                            }

                            if ($scope.config.submitted && !$scope.config.hasError && $scope.config.renderOptions.successMessage && $scope.config.renderOptions.successMessage) {
                                $scope.showSuccess = true;
                                $rootScope.neatFormSuccess = true;
                            } else {
                                $scope.showSuccess = false;
                                $rootScope.neatFormSuccess = false;
                            }

                            let pos = getElementOffset(document.querySelector("neat-form-wizard"));
                            window.scrollTo(0, pos.y);
                            resolve();
                        }, (err) => {
                            $scope.fields = [];
                            $scope.config = $scope.processConfig(err.data);
                            $scope.recalcGroupIndexes();
                            $scope.loading = false;
                            let pos = getElementOffset(document.querySelector("neat-form-wizard"));
                            window.scrollTo(0, pos.y);
                            reject(err);
                        });
                    }, (err) => {
                        $scope.loading = false;
                        reject(err);
                    }).catch((err) => {
                        $scope.loading = false;
                        reject(err);
                    });
                });

                $scope.loading = true;
                return $scope.submitProm;
            };


            $scope.validate = function () {
                if ($scope.loading) {
                    return $scope.validateProm;
                }

                $scope.validateProm = $q((resolve, reject) => {
                    let toValidate = [];
                    if ($scope.subforms && $scope.subforms.length) {
                        for (let i = 0; i < $scope.subforms.length; i++) {
                            toValidate.push($scope.subforms[i]);
                        }
                    }

                    return $scope.validateAllSubforms(toValidate).then(() => {

                        let values = $scope.getValues($scope.config);

                        return neatApi.formValidate({
                            _id: $scope.connectedId,
                            data: values,
                            form: $scope.form
                        }, (config) => {
                            $scope.loading = false;
                            $scope.fields = [];
                            $scope.config = $scope.processConfig(config);

                            $scope.recalcGroupIndexes();

                            if ($scope.config.renderOptions && $scope.config.renderOptions.successMessage) {
                                $scope.config.renderOptions.successMessage = $sce.trustAsHtml($scope.config.renderOptions.successMessage);
                            }

                            resolve();
                        }, (err) => {
                            $scope.fields = [];
                            $scope.config = $scope.processConfig(err.data);
                            $scope.recalcGroupIndexes();
                            $scope.loading = false;
                            reject(err);
                        });
                    }, (err) => {
                        $scope.loading = false;
                        reject(err);
                    }).catch((err) => {
                        $scope.loading = false;
                        reject(err);
                    });
                });

                $scope.loading = true;
                return $scope.validateProm;
            };

            $scope.processConfig = function (config, knownFields) {
                knownFields = knownFields || {};

                if (config.fields) {
                    for (let i = 0; i < config.fields.length; i++) {
                        let field = config.fields[i];
                        if (knownFields[field.id]) {
                            config.fields[i] = knownFields[field.id];
                        } else {
                            knownFields[field.id] = field;
                        }
                    }

                } else if (config.groups) {
                    for (let i = 0; i < config.groups.length; i++) {
                        let group = config.groups[i];
                        config.groups[i] = $scope.processConfig(group, knownFields);
                    }
                }

                return config;
            }

            $scope.saveAllSubforms = function (subforms) {
                return $q((resolve, reject) => {

                    if (!subforms || !subforms.length) {
                        return resolve();
                    }

                    let subform = subforms.shift();

                    return subform.submit().then(() => {
                        return $scope.saveAllSubforms(subforms).then(resolve, reject);
                    }, reject);
                });
            }

            $scope.validateAllSubforms = function (subforms) {
                return $q((resolve, reject) => {

                    if (!subforms || !subforms.length) {
                        return resolve();
                    }

                    let subform = subforms.shift();

                    return subform.validate().then(() => {
                        return $scope.validateAllSubforms(subforms).then(resolve, reject);
                    }, reject);
                });
            }
        }
    ]);
}