"use strict";
var __extends = (this && this.__extends) || (function () {
    var extendStatics = function (d, b) {
        extendStatics = Object.setPrototypeOf ||
            ({ __proto__: [] } instanceof Array && function (d, b) { d.__proto__ = b; }) ||
            function (d, b) { for (var p in b) if (b.hasOwnProperty(p)) d[p] = b[p]; };
        return extendStatics(d, b);
    };
    return function (d, b) {
        extendStatics(d, b);
        function __() { this.constructor = d; }
        d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
    };
})();
var __assign = (this && this.__assign) || function () {
    __assign = Object.assign || function(t) {
        for (var s, i = 1, n = arguments.length; i < n; i++) {
            s = arguments[i];
            for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p))
                t[p] = s[p];
        }
        return t;
    };
    return __assign.apply(this, arguments);
};
var __spreadArrays = (this && this.__spreadArrays) || function () {
    for (var s = 0, i = 0, il = arguments.length; i < il; i++) s += arguments[i].length;
    for (var r = Array(s), k = 0, i = 0; i < il; i++)
        for (var a = arguments[i], j = 0, jl = a.length; j < jl; j++, k++)
            r[k] = a[j];
    return r;
};
Object.defineProperty(exports, "__esModule", { value: true });
/*!
 * Copyright 2017-2018 Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */
var apollo_client_1 = require("apollo-client");
var apollo_link_1 = require("apollo-link");
var apollo_link_2 = require("apollo-link");
var apollo_utilities_1 = require("apollo-utilities");
var graphql_1 = require("graphql");
var complex_object_link_uploader_1 = require("./complex-object-link-uploader");
var ComplexObjectLink = /** @class */ (function (_super) {
    __extends(ComplexObjectLink, _super);
    function ComplexObjectLink(credentials) {
        var _this = _super.call(this) || this;
        _this.link = exports.complexObjectLink(credentials);
        return _this;
    }
    ComplexObjectLink.prototype.request = function (operation, forward) {
        return this.link.request(operation, forward);
    };
    return ComplexObjectLink;
}(apollo_link_2.ApolloLink));
exports.ComplexObjectLink = ComplexObjectLink;
exports.complexObjectLink = function (credentials) {
    return new apollo_link_2.ApolloLink(function (operation, forward) {
        return new apollo_link_1.Observable(function (observer) {
            var handle;
            var operationType = apollo_utilities_1.getOperationDefinition(operation.query).operation;
            var isMutation = operationType === 'mutation';
            var objectsToUpload = isMutation ? findInObject(operation.variables) : {};
            var uploadPromise = Promise.resolve(operation);
            if (Object.keys(objectsToUpload).length) {
                var uploadCredentials = typeof credentials === 'function' ? credentials.call() : credentials;
                uploadPromise = Promise.resolve(uploadCredentials)
                    .then(function (credentials) {
                    var uploadPromises = Object.entries(objectsToUpload).map(function (_a) {
                        var _ = _a[0], fileField = _a[1];
                        return complex_object_link_uploader_1.default(fileField, { credentials: credentials });
                    });
                    return Promise.all(__spreadArrays([operation], uploadPromises));
                })
                    .then(function (_a) {
                    var operation = _a[0], all = _a.slice(1);
                    return operation;
                })
                    .catch(function (err) {
                    var error = new graphql_1.GraphQLError(err.message);
                    error.errorType = 'AWSAppSyncClient:S3UploadException';
                    throw new apollo_client_1.ApolloError({
                        graphQLErrors: [error],
                        extraInfo: err,
                    });
                });
            }
            uploadPromise
                .then(forward)
                .then(function (observable) {
                handle = observable.subscribe({
                    next: observer.next.bind(observer),
                    error: observer.error.bind(observer),
                    complete: observer.complete.bind(observer),
                });
            }).catch(function (err) {
                observer.error(err);
            });
            return function () {
                if (handle)
                    handle.unsubscribe();
            };
        });
    });
};
var complexObjectFields = [
    { name: 'bucket', type: 'string' },
    { name: 'key', type: 'string' },
    { name: 'region', type: 'string' },
    { name: 'mimeType', type: 'string' },
    { name: 'localUri', type: ['object', 'string'] },
];
var findInObject = function (obj) {
    var testFn = function (val) {
        return complexObjectFields.every(function (field) {
            var hasValue = val[field.name];
            var types = Array.isArray(field.type) ? field.type : [field.type];
            var isOfType = hasValue && types.reduce(function (prev, curr) {
                return prev || typeof val[field.name] === curr;
            }, false);
            return isOfType;
        });
    };
    var _findInObject = function (obj, path, acc) {
        if (path === void 0) { path = ''; }
        if (acc === void 0) { acc = {}; }
        if (!obj) {
            return acc;
        }
        if (testFn(obj)) {
            acc[path] = __assign({}, obj);
            delete obj.mimeType;
            delete obj.localUri;
        }
        if (typeof obj === 'object') {
            Object.keys(obj).forEach(function (key) {
                var val = obj[key];
                if (Array.isArray(val)) {
                    val.forEach(function (v, i) { return _findInObject(v, path + "." + key + "[" + i + "]", acc); });
                }
                else if (typeof val === 'object') {
                    _findInObject(val, "" + path + (path && '.') + key, acc);
                }
            });
        }
        return _findInObject(null, path, acc);
    };
    return _findInObject(obj);
};
