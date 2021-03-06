/**
 * AngulateJS v0.1.0
 * Copyright 2013, Hybrid Labs
 * License: MIT
 */

(function(global) {
  'use strict';

  var angular = global.angular;
  var angulate = global.angulate = angular.module('angulate', []);
  var selector = global.jQuery || document.querySelectorAll;
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
    if (element.parent().length) $animate.leave(element);
  }

  function enter($animate, element, after) {
    if (!element.parent().length) $animate.enter(element, null, after);
  }

  function attr(element, attrs) {
    var attr;
    angular.forEach(attrs.$attr, function(a) {
      if (a[0] === ':') {
        if (attr) exception(element, 'Element has multiple bindings');
        attr = a.slice(1);
      }
    });

    if (!attr) exception(element, 'Element has no binding attribute');
    return attr;
  }

  function watch(scope, attr) {
    var $parse = angular.injector(['ng']).get('$parse');
    return angular.isFunction($parse(attr)(scope)) ? attr + '(this)' : attr;
  }

  function equalityScope(scope) {
    // Patch $watch and $watchCollection to use object equality
    var _$watch = scope.$watch;

    scope.$watch = function $watch(watch, listener) {
      return _$watch.apply(this, [watch, listener, true]);
    };

    scope.$watchCollection = function $watchCollection(watch, listener) {
      return _$watch.apply(this, [watch, listener, true]);
    };

    return scope;
  }

  function registerTemplate(name, element) {
    if (angular.isString(element)) {
      element = angular.element(selector('#' + element));
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
      if (!scope) return undefined;
      return scope.$item && scope.$item[name] != undefined ?
        (new Array(level + 1)).join('$parent.') + '$item.' + name :
        repeatScopeSearch(scope.$parent, name, level + 1);
    }

    function link(scope, element, attrs) {
      var bind = attr(element, attrs);
      var repeatScopeValue = scope.$item == undefined ?
        undefined : repeatScopeSearch(scope, bind, 0);

      if (element.attr('model')) {
        // Replace this element with a clone with ng-model
        var model = forkElement(element, 'ng-model', bind, scope.$parent);
        element.replaceWith(model.element);
      }
      else {
        var display = element.css('display');
        var bindName = watch(scope, bind);

        var repeat = '$item in ' + bindName + ' track by ' +
          (attrs.track || '$index');

        // Create repeat element after this element
        repeat = forkElement(element, 'ng-repeat', repeat,
          equalityScope(scope.$parent.$new()));

        element.after(repeat.element);

        // Watch changes and adjust view depending bind data type
        scope.$watch(bindName, function bindWatch(v) {
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
              if (angular.isObject(v)) angular.extend(scope, v);
            }
          }
        }, true);

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
        var model = ['INPUT', 'SELECT', 'TEXTAREA'];
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

  function classDirective() {
    return {
      restrict: 'A',
      link: function(scope, elements, attrs) {
        var classTrack = {};
        angular.forEach(attrs['class'].split(' '), function(a) {
          if (a[0] !== ':') return;

          var cls = a.slice(1);
          var className = watch(scope, a.slice(1));
          scope.$watch(className, function(v, old) {
            if (old) {
              if (!angular.isString(old)) old = cls;
              classTrack[old] = (classTrack[old] || 0) - 1;
              if (classTrack[old] <= 0) {
                delete classTrack[old];
                elements.removeClass(old);
              }
            }

            if (v) {
              if (!angular.isString(v)) v = cls;
              classTrack[v] = (classTrack[v] || 0) + 1;
              elements.addClass(v);
            }
          });
        });
      }
    }
  }

  ifDirective.$inject = ['$animate'];
  function ifDirective($animate) {
    return {
      restrict: 'EA',
      link: function(scope, element, attrs) {
        var condition = attr(element, attrs);
        var conditionName = watch(scope, condition);

        var negate = attrs.not != undefined;
        var marker = negate ?
          document.createComment('if: ' + conditionName) :
          document.createComment('if not: ' + conditionName);

        // Insert marker to track DOM location
        marker = angular.element(marker);
        element.after(marker);
        element.remove();
        marker.after(element);

        scope.$watch(conditionName, function ifWatch(v) {
          if (negate ? !v : v) {
            enter($animate, element, marker);
          }
          else {
            leave($animate, element);
          }
        }, true);
      }
    }
  }

  function templateDirective() {
    return {
      restrict: 'EA',
      compile: function(element, attrs) {
        var name = attr(element, attrs);
        element.replaceWith(
          angular.element('<script type="text/x-angulate-template">')
            .html(element.html())
        );

        registerTemplate(name, element);
      }
    }
  }

  function componentDirective() {
    return {
      restrict: 'EA',
      controller: ['$scope', '$element', '$attrs', '$injector',
        function scopeController($scope, $element, $attrs, $injector) {
          var controller = global[attr($element, $attrs)];
          if (controller) {
            $injector.invoke(controller, this, {
              $scope: $scope,
              $element: $element
            });
          }
        }
      ],
      compile: function(element, attrs) {
        var name = attr(element, attrs);
        if (!templates[name]) exception(element, 'Template not found', name);
        element.html(templates[name].html());
      }
    }
  }

  // Register directives
  angulate.directive('bind', bindDirective);
  angulate.directive('class', classDirective);
  angulate.directive('if', ifDirective);
  angulate.directive('template', templateDirective);
  angulate.directive('component', componentDirective);


  /* IE fixes */

  if (!Array.prototype.indexOf) {
    Array.prototype.indexOf = function(find, i) {
      if (i === undefined) i = 0;
      if (i < 0) i += this.length;
      if (i < 0) i = 0;
      for (var n = this.length; i < n; i++) {
        if (i in this && this[i] === find) return i;
      }
      return -1;
    };
  }

  document.createElement('bind');
  document.createElement('if');
  document.createElement('template');
  document.createElement('component');


  /* Public */

  angulate.registerTemplate = registerTemplate;
})(this);
