"use strict";

module.exports = function (neatFormModule) {
    return [
        function () {
            return {
                restrict: "E",
                template: require("./Select.html"),
                scope: {
                    config: "="
                },
                controller: [
                    "$scope",
                    function ($scope) {
                        // make this a string because of object options we cant have numbers as keys (values)
                        $scope.config.value = typeof $scope.config.value === "number" ? String($scope.config.value) : $scope.config.value;

                        $scope.$watch("value", () => {
                            if($scope.config && $scope.value){
                                $scope.config.value = $scope.value.value;
                            }
                        });

                        // $scope.$watch("config.options", () => {
                            let arr = [];

                            // convert object to array for sorting reasons
                            if ($scope.config.options instanceof Object) {
                                for (let value in $scope.config.options) {
                                    let label = $scope.config.options[value];
                                    arr.push({
                                        value,
                                        label
                                    });
                                }
                            }

                            // Sort default option to the top
                            arr = arr.sort((a, b) => {
                                if (a.value === null || a.value === "null") {
                                    return -1;
                                }
                                else if (b.value === null || b.value === "null") {
                                    return 1;
                                }
                                else if(a.label < b.label){
                                    return -1;
                                }
                                else if(b.label < a.label){
                                    return 1;
                                }


                                return 0;
                            });

                            $scope.options = arr;

                            $scope.value = arr.find((item)=> {
                                return item.value === $scope.config.value;
                            });
                        // });
                    }
                ]
            };
        }
    ];
}