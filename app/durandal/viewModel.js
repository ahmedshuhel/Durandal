﻿define(function(require) {
    var system = require('durandal/system');

    function ensureSettings(settings) {
        if (settings == undefined) {
            settings = { };
        } else if (typeof settings == "boolean") {
            settings = {
                activate: settings
            };
        }

        if (!settings.closeOnDeactivate) {
            settings.closeOnDeactivate = true;
        }

        if (!settings.beforeActivate) {
            settings.beforeActivate = function(newItem) {
                return newItem;
            };
        }

        if (!settings.afterDeactivate) {
            settings.afterDeactivate = function() { };
        }
        
        if (!settings.interpretGuard) {
            settings.interpretGuard = function (value) {
                if (typeof value == 'string') {
                    return value == 'Yes' || value == 'Ok';
                }

                return value;
            };
        }

        return settings;
    }

    function createActivator(initialActiveItem, settings) {
        var activeItem = ko.observable(null);
        settings = ensureSettings(settings);

        var computed = ko.computed({
            read: function() {
                return activeItem();
            },
            write: function (newValue) {
                computed.activateItem(newValue);
            }
        });

        computed.canDeactivateItem = function(item, close) {
            return system.defer(function(dfd) {
                if (item && item.canDeactivate) {
                    var resultOrPromise = item.canDeactivate(close);

                    if (resultOrPromise.then) {
                        resultOrPromise.then(function(result) {
                            dfd.resolve(settings.interpretGuard(result));
                        });
                    } else {
                        dfd.resolve(settings.interpretGuard(resultOrPromise));
                    }
                } else {
                    dfd.resolve(true);
                }
            }).promise();
        };
        
        function doDeactivation(item, close, dfd) {
            if (item && item.deactivate) {
                system.log("Deactivating", item);

                var promise = item.deactivate(close);

                if (promise && promise.then) {
                    promise.then(function () {
                        settings.afterDeactivate(item, close);
                        dfd.resolve(true);
                    });
                } else {
                    settings.afterDeactivate(item, close);
                    dfd.resolve(true);
                }
            } else {
                if (item) {
                    settings.afterDeactivate(item, close);
                }

                dfd.resolve(true);
            }
        }

        computed.deactivateItem = function(item, close) {
            return system.defer(function(dfd) {
                computed.canDeactivateItem(item, close).then(function(canDeactivate) {
                    if (canDeactivate) {
                        doDeactivation(item, close, dfd);
                    } else {
                        computed.notifySubscribers();
                        dfd.resolve(false);
                    }
                });
            });
        };

        computed.canActivateItem = function (item) {
            return system.defer(function (dfd) {
                if (item == activeItem()) {
                    dfd.resolve(true);
                    return;
                }

                if (item && item.canActivate) {
                    var resultOrPromise = item.canActivate();
                    if (resultOrPromise.then) {
                        resultOrPromise.then(function (result) {
                            dfd.resolve(settings.interpretGuard(result));
                        });
                    } else {
                        dfd.resolve(settings.interpretGuard(resultOrPromise));
                    }
                } else {
                    dfd.resolve(true);
                }
            }).promise();
        };

        function doActivation(item, dfd) {
            activeItem(item);

            if (item && item.activate) {
                system.log("Activating", item);

                var promise = item.activate();

                if (promise && promise.then) {
                    promise.then(function () {
                        dfd.resolve(true);
                    });
                } else {
                    dfd.resolve(true);
                }
            } else {
                dfd.resolve(true);
            }
        }

        computed.activateItem = function (newItem) {
            return system.defer(function(dfd) {
                var currentItem = activeItem();
                if (currentItem == newItem) {
                    dfd.resolve(true);
                    return;
                }

                computed.canDeactivateItem(currentItem, settings.closeOnDeactivate).then(function(canDeactivate) {
                    if (canDeactivate) {
                        computed.canActivateItem(newItem).then(function(canActivate) {
                            if (canActivate) {
                                system.defer(function(dfd2) {
                                    doDeactivation(currentItem, settings.closeOnDeactivate, dfd2);
                                }).promise().then(function() {
                                    newItem = settings.beforeActivate(newItem);
                                    doActivation(newItem, dfd);
                                });
                            } else {
                                computed.notifySubscribers();
                                dfd.resolve(false);
                            }
                        });
                    } else {
                        computed.notifySubscribers();
                        dfd.resolve(false);
                    }
                });
            }).promise();
        };

        computed.canActivate = function() {
            var toCheck;

            if (initialActiveItem) {
                toCheck = initialActiveItem;
                initialActiveItem = false;
            } else {
                toCheck = computed();
            }

            return computed.canActivateItem(toCheck);
        };

        computed.activate = function() {
            var toActivate;

            if (initialActiveItem) {
                toActivate = initialActiveItem;
                initialActiveItem = false;
            } else {
                toActivate = computed();
            }

            return computed.activateItem(toActivate);
        };

        computed.canDeactivate = function(close) {
            return computed.canDeactivateItem(computed(), close);
        };

        computed.deactivate = function(close) {
            return computed.deactivateItem(computed(), close);
        };

        computed.includeIn = function (parent) {
            parent.canActivate = function () {
                return computed.canActivate();
            };

            parent.activate = function () {
                return computed.activate();
            };

            parent.canDeactivate = function (close) {
                return computed.canDeactivate(close);
            };

            parent.deactivate = function (close) {
                return computed.deactivate(close);
            };
        };

        if (settings.parent) {
            computed.includeIn(settings.parent);
        } else if (settings.activate) {
            computed.activate();
        }

        computed.for = function (items) {
            settings.closeOnDeactivate = false;

            settings.determineNextItemToActivate = function(list, lastIndex) {
                var toRemoveAt = lastIndex - 1;

                if (toRemoveAt == -1 && list.length > 1) {
                    return list[1];
                }

                if (toRemoveAt > -1 && toRemoveAt < list.length - 1) {
                    return list[toRemoveAt];
                }

                return null;
            };

            settings.beforeActivate = function (newItem) {
                var currentItem = computed();

                if (!newItem) {
                    newItem = settings.determineNextItemToActivate(items, currentItem ? items.indexOf(currentItem) : 0);
                } else {
                    var index = items.indexOf(newItem);

                    if (index == -1) {
                        items.push(newItem);
                    } else {
                        newItem = items()[index];
                    }
                }
                
                return newItem;
            };

            settings.afterDeactivate = function(oldItem, close) {
                if (close) {
                    items.remove(oldItem);
                }
            };

            var originalCanDeactivate = computed.canDeactivate;
            computed.canDeactivate = function(close) {
                if (close) {
                    return system.defer(function(dfd) {
                        var list = items();
                        var results = [];

                        function finish() {
                            for (var j = 0; j < results.length; j++) {
                                if (!results[j]) {
                                    dfd.resolve(false);
                                    return;
                                }
                            }

                            dfd.resolve(true);
                        }

                        for (var i = 0; i < list.length; i++) {
                            computed.canDeactivateItem(list[i], close).then(function(result) {
                                results.push(result);
                                if (results.length == list.length) {
                                    finish();
                                }
                            });
                        }
                    }).promise();
                } else {
                    return originalCanDeactivate;
                }
            };

            var originalDeactivate = computed.deactivate;
            computed.deactivate = function(close) {
                if (close) {
                    return system.defer(function(dfd) {
                        var list = items();
                        var results = 0;
                        var listLength = list.length;

                        function doDeactivate(item) {
                            computed.deactivateItem(item, close).then(function() {
                                results++;
                                items.remove(item);
                                if (results == listLength) {
                                    dfd.resolve();
                                }
                            });
                        }

                        for (var i = 0; i < listLength; i++) {
                            doDeactivate(list[i]);
                        }
                    }).promise();
                } else {
                    return originalDeactivate;
                }
            };

            return computed;
        };

        return computed;
    }

    return {
        activator: createActivator
    };
});