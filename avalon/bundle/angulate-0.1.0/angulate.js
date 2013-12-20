/**
 * AngulateJS v0.1.0
 * Copyright 2013, Hybrid Labs
 * License: MIT
 */

;
(function(global) {
  'use strict';

  var angular = global.angular;
  var angulate = global.angulate = angular.module('angulate', []);
  var templates = {};


  /* Helpers */

  function exception(element) {
    var args = Array.prototype.slice.call(arguments);

    if (angular.isObject(element)) {
      console.error('Element:', element);
      args.shift();
    }
    throw args.join(' ');
  }

  function leave($animate, element) {
    if (element.parent().length) {
      $animate.leave(element);
    }
  }

  function enter($animate, element, after) {
    if (!element.parent().length) {
      $animate.enter(element, null, after);
    }
  }

  function attr(element, attrs) {
    var attr;
    angular.forEach(attrs.$attr, function(a) {
      if (a[0] === ':') {
        if (attr) {
          exception(element, 'Element has multiple bindings');
        }
        attr = a.slice(1);
      }
    });

    if (!attr) {
      exception(element, 'Element has no binding attribute')
    }
    return attr;
  }

  function registerTemplate(name, element) {
    if (angular.isString(element)) {
      element = angular.element(document.querySelector('#' + element));
    }
    templates[name] = element;
  }


  /* Directives */

  bindDirective.$inject = ['$compile', '$animate'];
  function bindDirective($compile, $animate) {
    function forkElement(element, attr, attrValue, scope) {
      var clone = element.clone()
        .attr(attr, attrValue)
        .removeAttr('bind');

      $compile(clone)(scope);
      return {
        element: clone,
        scope: scope
      };
    }

    function repeatScopeSearch(scope, name, level) {
      if (!scope) {
        return undefined;
      }

      return scope._v && scope._v[name] != undefined ?
        (new Array(level + 1)).join('$parent.') + '_v.' + name :
        repeatScopeSearch(scope.$parent, name, level + 1);
    }

    function link(scope, element, attrs) {
      var bind = attr(element, attrs);
      var repeatScopeValue = scope._v == undefined ? undefined :
        repeatScopeSearch(scope, bind, 0);

      if (element.attr('model')) {
        // Replace this element with a clone with ng-model
        var model = forkElement(element, 'ng-model', bind,
          scope.$parent);

        element.replaceWith(model.element);
      }
      else {
        var display = element.css('display');
        var repeat = '_v in ' + bind + ' track by ' +
          (attrs.track || '$index');

        // Create repeat element after this element
        repeat = forkElement(element, 'ng-repeat', repeat,
          scope.$parent.$new());

        element.after(repeat.element);

        // Watch changes and adjust view depending bind data type
        scope.$watch(bind, function bindWatch(v) {
          if (element.attr('leaf')) {
            element.text(v == undefined ? '' : v);
            repeat.scope[bind] = null;
          }
          else {
            if (!v) {
              leave($animate, element);
              return;
            }

            element.css('display', display);
            if (angular.isArray(v)) {
              // Propagate data from parent scope
              delete repeat.scope[bind];
              leave($animate, element);
            }
            else {
              // Hide data from parent scope
              repeat.scope[bind] = null;
              enter($animate, element, repeat.element);

              // Extend scope binding
              if (angular.isObject(v)) {
                angular.extend(scope, v);
              }
            }
          }
        });

        // Extend repeat scope binding
        if (repeatScopeValue) {
          scope.$watch(repeatScopeValue, function repeatScopeWatch(v) {
            scope[bind] = v;
          });
        }
      }
    }

    return {
      restrict: 'EA',
      scope: true,
      compile: function(element, attr) {
        var model = ['INPUT', 'SELECT'];
        var tag = element.prop('tagName').toUpperCase();
        if (model.indexOf(tag) != -1) {
          attr.$set('model', true);
        }
        else {
          attr.$set('model', undefined);
          if (element.contents().length == 0) {
            attr.$set('leaf', true);
          }
          else {
            attr.$set('leaf', undefined);
          }
        }
        return link;
      }
    }
  }

  ifDirective.$inject = ['$animate'];
  function ifDirective($animate) {
    return {
      restrict: 'EA',
      link: function(scope, element, attrs) {
        var condition = attr(element, attrs);
        var negate = attrs.not != undefined;
        var marker = negate ?
          document.createComment('if: ' + condition) :
          document.createComment('if not: ' + condition);

        // Insert marker to track DOM location
        marker = angular.element(marker);
        element.after(marker);
        element.remove();
        marker.after(element);

        scope.$watch(condition, function ifWatch(v) {
          if (negate ? !v : v) {
            enter($animate, element, marker);
          }
          else {
            leave($animate, element);
          }
        });
      }
    }
  }

  function templateDirective() {
    return {
      restrict: 'EA',
      compile: function(element, attrs) {
        var name = attr(element, attrs);
        element.replaceWith(
          angular.element('<script type="text/x-avalon-template">')
            .html(element.html())
        );

        registerTemplate(name, element);
      }
    }
  }

  function componentDirective() {
    return {
      restrict: 'EA',
      compile: function(element, attrs) {
        var name = attr(element, attrs);
        if (!templates[name]) {
          exception(element, 'Template not found', name);
        }
        element.replaceWith(templates[name].html());
      }
    }
  }

  // Register directives
  angulate.directive('bind', bindDirective);
  angulate.directive('if', ifDirective);
  angulate.directive('template', templateDirective);
  angulate.directive('component', componentDirective);

  // Pre-create for Internet Explorer (IE)
  document.createElement('bind');
  document.createElement('if');
  document.createElement('template');
  document.createElement('component');


  /* Public */

  angulate.registerTemplate = registerTemplate;
})(this);