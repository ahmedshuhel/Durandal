﻿define(function (require) {
    var http = require('durandal/http');
    
    var Flickr = function() {
        this.displayName = 'Flickr';
        this.images = ko.observableArray([]);
    };

    function callFlickrAPI(vm, search) {
        return http.jsonp("http://api.flickr.com/services/feeds/photos_public.gne", { tags:search, tagmode: "any", format: "json" }, "jsoncallback").then(function (response) {
            vm.images(response.items);
        });
    }

    //The activator created in the shell calls 'activate' on any view model that it's set to.
    //You can optionally return a promise for async activation.
    //NOTE: All Durandal's async operations return promises and so do all jQuery's ajax functions, so
    //they can be easily composed together and used in async screen activation scenarios.
    Flickr.prototype.activate = function() {
        return callFlickrAPI(this, "mount ranier");
    };

    return Flickr;
});