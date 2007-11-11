// Copyright (C) 2007 Google Inc.
//      
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
// http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.
// .............................................................................

// This module is the Caja runtime library. It is written in
// Javascript, not Caja, and would be rejected by the Caja
// translator. This module exports two globals: 
// * "___" for use by the output of the Caja translator and by some
//   other untranslated Javascript code.
// * "caja" providing some common services to the Caja programmer.


// Caja adds the following common Javascript extensions to ES3

if (Array.prototype.indexOf === undefined) {
    /** 
     * Returns the first index at which the specimen is found (by
     * "===") or -1 if none.  
     */
    Array.prototype.indexOf = function(specimen) {
        var i;
        var len = this.length;
        for (var i = 0; i < len; i += 1) {
            if (this[i] === specimen) {
                return i;
            }
        }
        return -1;
    };
}

if (Array.prototype.lastIndexOf === undefined) {
    /** 
     * Returns the last index at which the specimen is found (by
     * "===") or -1 if none.  
     */
    Array.prototype.lastIndexOf = function(specimen) {
        var i;
        for (var i = this.length-1; i >= 0; i -= 1) {
            if (this[i] === specimen) {
                return i;
            }
        }
        return -1;
    };
}

if (Date.prototype.toISOString === undefined) {
    /**
     * Like the date.toJSONString() method defined in json.js, but
     * without the surrounding quotes.
     */
    Date.prototype.toISOString = function() {
        function f(n) {
            return n < 10 ? '0' + n : n;
        }
        return (this.getUTCFullYear()     + '-' +
                f(this.getUTCMonth() + 1) + '-' +
                f(this.getUTCDate())      + 'T' +
                f(this.getUTCHours())     + ':' +
                f(this.getUTCMinutes())   + ':' +
                f(this.getUTCSeconds())   + 'Z');
    };
}


// caja.js exports the following names to the Javascript global
// namespace. Caja code can only use the "caja" object. The "___"
// object is for use by code generated by the Caja translator, and by
// Javascript code (such as a powerbox) in the embedding application.

var caja;
var ___;

(function() {

    /** 
     * Like an assert that can't be turned off.
     * <p>
     * Either returns true (on success) or throws (on failure).
     * Sometimes, an informative diagnostic takes some calculation that
     * we'd rather not pay for in the typical success case. To
     * accomodate this, if complaint is a function, we'll call it
     * first to get the actual complaint. After this, if the complaint
     * is a string, we'll wrap it in a <tt>new Error(complaint)</tt>
     * before throwing it.
     */
    function require(test,complaint) {
        if (test) { return true; }
        if (typeof complaint === 'function') {
            complaint = complaint();
        }
        if (typeof complaint === 'string') {
            complaint = new Error(complaint);
        }
        throw complaint;
    }

    /**
     * requires <tt>typeof specimen === typename</tt>.
     * <p>
     * If not, throws an informative TypeError
     */
    function requireType(specimen,typename,opt_name) {
        require(typeof specimen === typename, function() {
            return new TypeError('expected ' + typename + 
                                 ' instead of ' + typeof specimen +
                                 ': ' + (opt_name||specimen));
        });
        return specimen;
    }

    function requireNat(specimen) {
        requireType(specimen,'number');
        require(Math.floor(specimen) === specimen,
                'Must be integral: '+specimen);
        require(specimen >= 0,'Must not be negative: '+specimen);
        // Could pre-compute precision limit, but probably not faster
        // enough to be worth it.
        require(Math.floor(specimen-1) === specimen-1,
                'Beyond precision limit: '+specimen);
        return specimen;
    }

    /**
     * Does str end with suffix? 
     */
    function endsWith(str,suffix) {
        requireType(str,'string');
        requireType(suffix,'string');
        var strLen = str.length;
        var sufLen = suffix.length;
        return strLen >= sufLen && 
            (str.substring(strLen-sufLen,strLen) === suffix);
    }

    if (Function.prototype.apply___ === undefined) {
        Function.prototype.apply___ = Function.prototype.apply;
    }
    Function.prototype.apply = function(that,args) {
        require(typeof that === 'object',
                'Can only apply() with object: '+that+'/'+this+'/'+args);
        require(that !== null,"Can't apply() with null");
        // XXX TODO Bug: Allowing <tt>that</tt> to have a valueOf()
        // opens a security hole in Firefox. But disallowing it breaks
        // all objects, such as Object("foo"), that legitimately have
        // a valueOf() method. Help!
        //
        // require(!('valueOf' in that),
        //         'Apply() with valueOf() broken on Firefox');
        return this.apply___(that,args);
    };
    if (Function.prototype.call___ === undefined) {
        Function.prototype.call___ = Function.prototype.call;
    }
    Function.prototype.call = function(that,varargs) {
        var args = Array.prototype.slice.call___(arguments,1);
        return this.apply(that,args);
    };

    var originalHOP_ = Object.prototype.hasOwnProperty;
    if ('___ORIGINAL___' in originalHOP_) {
        originalHOP_ = originalHOP_.___ORIGINAL___;
    }

    /**
     * <tt>hasOwnProp(obj.prop)</tt> means what
     * <tt>obj.hasOwnProperty(prop)</tt> would normally mean in an
     * unmodified Javascript system.
     */
    function hasOwnProp(obj,name) { return originalHOP_.call___(obj,name); }

    /**
     * Returns the 'constructor' property of obj's prototype.
     * <p>
     * By "obj's prototype", we mean the object that obj directly
     * inherits from, not the value of its 'prototype' property. If
     * obj has a '__proto__' property, then we assume we're on a
     * platform (like Firefox) in which this reliably gives us obj's
     * prototype.
     * <p>
     * If obj is a function or not an object, return undefined.
     */
    function directConstructor(obj) {
        if (obj === null) { return undefined; }
        if (typeof obj !== 'object') {
            // Note that functions thereby return undefined,
            // so directConstructor() doesn't provide access to the
            // forbidden Function constructor.
            return undefined;
        }
        // The following test will always return false in IE
        if ('__proto__' in obj) { 
            if (obj.__proto__ === null) { return undefined; }
            return obj.__proto__.constructor; 
        }
        
        var result;
        if (!hasOwnProp(obj,'constructor')) { 
            result = obj.constructor;
        } else {
            var OldConstr = obj.constructor;
            if (!(delete obj.constructor)) { return undefined; }
            result = obj.constructor;
            obj.constructor = OldConstr;
        }
        if (result.prototype.constructor === result) {
            // Memoize, so it'll be faster next time.
            obj.__proto__ = result.prototype;
        }
        return result;
    }

    /**
     * A JSON container is an object whose direct constructor is
     * Object or Array.
     * <p>
     * These are the kinds of non-primitive objects that can be
     * expressed in the JSON language.
     */
    function isJSONContainer(obj) {
        var Constr = directConstructor(obj);
        return Constr === Object || Constr === Array;
    }

    /**
     * Is Caja code unable to directly assign to properties of obj?
     */
    function isFrozen(obj) { return hasOwnProp(obj,'___FROZEN___'); }

    /**
     * Mark obj frozen so that Caja code cannot directly assign to its
     * properties.
     * <p>
     * XXX TODO BUG: Currently, this does not yet require that obj's
     * prototype itself also be frozen. 
     */
    function freeze(obj) {
        for (var k in obj) {
            if (endsWith(k,'_canSet___')) { obj[k] = false; }
        }
        obj.___FROZEN___ = true;
        return obj;
    }

    /** Tests whether the fast-path canRead flag is set. */
    function canRead(obj,name) { return !!obj[name+'_canRead___']; }
    /** Tests whether the fast-path canEnum flag is set. */
    function canEnum(obj,name) { return !!obj[name+'_canEnum___']; }
    /** Tests whether the fast-path canSet flag is set. */
    function canSet(obj,name)  { return !!obj[name+'_canSet___']; }

    /** 
     * Sets the fast-path canRead flag.
     * <p>
     * The various <tt>allow*</tt> functions are called externally by
     * Javascript code to express whitelisting taming decisions. And
     * they are called internally to memoize decisions arrived at by
     * other means. 
     */
    function allowRead(obj,name) { return obj[name+'_canRead___'] = true; }

    /** allowEnum implies allowRead */
    function allowEnum(obj,name) { 
        return obj[name+'_canEnum___'] = allowRead(obj,name);
    }

    /** allowSet implies allowEnum and allowRead */
    function allowSet(obj,name) {
        return obj[name+'_canSet___'] = allowEnum(obj,name);
    }

    /** Can Caja code only call Constr with <tt>new</tt>? */
    function isCtor(Constr) { return !!Constr.___CONSTRUCTOR___; }

    /** Can Caja code only call meth as a method? */
    function isMethod(meth) { return !!meth.METHOD_OF; }

    /** Can Caja code call meth as a method of receiver? */
    function isMethodOf(meth,receiver) {
        if (isMethod(meth)) {
            return receiver instanceof meth.___METHOD_OF___;
        } else {
            return !isCtor(meth);
        }
    }

    /** Mark Constr as something to be called only with <tt>new</tt>. */
    function ctor(Constr,opt_Sup,opt_name) {
        requireType(Constr,'function',opt_name);
        require(!isMethod(Constr), "Methods can't be constructors");
        Constr.___CONSTRUCTOR___ = true;
        if (opt_Sup) {
            setSuper(Constr,opt_Sup);
        }
        return Constr; // translator freezes constructor later
    }

    /** Mark meth as a method of instances of Constr. */
    function method(Constr,meth,opt_name) {
        requireType(meth,'function',opt_name);
        require(!isCtor(meth), "constructors can't be methods");
        requireType(Constr,'function');
        require(!isMethod(Constr), "Methods can't have methods");
        meth.___METHOD_OF___ = Constr;
        return freeze(meth);
    }

    /**
     * For now, just freezes and returns it.
     * <p>
     * Will be able to provide the pluginMaker or a made plugin to
     * some registered callback object.
     */
    function module(pluginMaker) {
        return freeze(pluginMaker);
    }

    /**
     * Was obj made by a Caja <tt>new</tt> but not yet cooked by a
     * base constructor?
     */
    function isRaw(obj) { return !!obj.___RAW___; }
    
    /**
     * Makes a raw instance that inherits correctly but is not yet
     * constructed.
     * <p>
     * Caja's <tt>new</tt> translates to call makeRaw and pass the
     * result to the actual constructor.
     */
    function makeRaw(Constr) {
        function F() { this.___RAW___ = true; }
        F.prototype = Constr.prototype;
        return new F();
    }

    /**
     * A base constructor other than Object or Array should first cook
     * their <tt>this</tt>, and require that it wasn't already cooked.
     * <p>
     * A constructed object has three states: 
     * <ol>
     * <li>After allocation but before entering the base constructor,
     *     the object is "raw".
     * <li>After having entered the base constructor, the object is
     *     "cooking".
     * <li>Once it's fully constructed, i.e., once the actual
     *     constructor that was called with <tt>new</tt> exits, the
     *     object is "cooked". 
     * </ol>
     * Currently, we do not represent the difference between "cooking"
     * and "cooked". But the difference is important for reasoning
     * about correctness. Only a cooked object should need to be
     * defensively correct. Constructors should therefore normally not
     * to let a reference to <tt>this</tt> escape, as an uncooked
     * object cannot yet defend itself.
     */
    function cookIfRaw(obj) {
        return delete obj.___RAW___;
    }

    /** 
     * Can a constructed Caja object read this property on itself? 
     * <p>
     * Can a Caja method whose <tt>this</tt> is bound to <tt>that</tt>
     * read its own <tt>name</tt> property? For properties added to
     * the object by Caja code, the answer is yes. For other
     * properties, which must therefore be inherited from a prototype
     * written in Java rather than Caja, the answer is: iff they were
     * whitelisted.
     */
    function canReadProp(that,name) {
        if (endsWith(name,'__')) { return false; }
        return canRead(that,name);
    }

    /** 
     * A constructed Caja object's attempt to read this property on
     * itself.
     * <p>
     * If it can't, it reads <tt>undefined</tt> instead.
     */
    function readProp(that,name) {
        return canReadProp(that,name) ? that[name] : undefined;
    }

    /** 
     * Can a Caja client of <tt>obj</tt> read its <name> property? 
     * <p>
     * If the property is Internal (i.e. ends in an '_'), then no.
     * If the property was defined by Caja code, then yes. If it was
     * whitelisted, then yes. Or if the property is an own property of
     * a JSON container, then yes.
     */
    function canReadPub(obj,name) {
        if (endsWith(name,'_')) { return false; }
        if (canRead(obj,name)) { return true; }
        if (!isJSONContainer(obj)) { return false; }
        if (!hasOwnProp(obj,name)) { return false; }
        return allowRead(obj,name); // memoize
    }
    
    /**
     * Caja code attempting to read a property on something besides
     * <tt>this</tt>.
     * <p>
     * If it can't, it reads <tt>undefined</tt> instead.
     */
    function readPub(obj,name) {
        return canReadPub(obj,name) ? obj[name] : undefined;
    }

    /** 
     * Would a Caja for/in loop on <tt>this</tt> see this name? 
     * <p>
     * For properties defined in Caja, this is generally the same as
     * canReadProp. Otherwise according to whitelisting.
     */
    function canEnumProp(that,name) {
        if (endsWith(name,'__')) { return false; }
        return canEnum(that,name);
    }

    /** 
     * Would a Caja for/in loop by a client of obj see this name? 
     * <p>
     * For properties defined in Caja, this is generally the same as
     * canReadProp. Otherwise according to whitelisting.
     */
    function canEnumPub(obj,name) {
        if (endsWith(name,'_')) { return false; }
        if (canEnum(obj,name)) { return true; }
        if (!isJSONContainer(obj)) { return false; }
        if (!hasOwnProp(obj,name)) { return false; }
        return allowEnum(obj,name); // memoize
    }

    /** 
     * Can a method of a Caja constructed object directly assign to
     * this property of its object?
     * <p>
     * Iff this object isn't frozen.
     */
    function canSetProp(that,name) {
        if (endsWith(name,'__')) { return false; }
        if (canSet(that,name)) { return true; }
        return !isFrozen(that);
    }

    /**
     * A Caja method tries to assign to this property of its object.
     */
    function setProp(that,name,val) {
        require(canSetProp(that,name), 'not settable: ' + name);
        allowSet(that,name); // grant
        return that[name] = val;
    }

    /**
     * Can a client of obj directly assign to its name property?
     * <p>
     * If this property is Internal (i.e., ends with a '_') or if it
     * is an own property of a frozen object, then no. 
     * If this property is not Internal and was defined by Capri code,
     * then yes. If the object is a JSON container, then
     * yes. Otherwise according to whitelisting decisions.
     * <p>
     * The non-obvious implication of this rule together with the
     * canSetProp rule is that a Caja client of a Caja constructed
     * object cannot add new properties to it. But a Caja constructed
     * object can add new properties to itself, and its clients can
     * then assign to these properties.
     */
    function canSetPub(obj,name) {
        if (endsWith(name,'_')) { return false; }
        if (canSet(obj,name)) { return true; }
        return !isFrozen(obj) && isJSONContainer(obj);
    }

    /** A client of obj attempts to assign to one of its properties. */
    function setPub(obj,name,val) {
        require(canSetPub(obj,name), "can't set: " + name);
        allowSet(obj,name); // grant
        return obj[name] = val;
    }

    /**
     * A Caja constructed object attempts to delete one of its own
     * properties. 
     * <p>
     * A property is only deletable if it is also settable.
     * <p>
     * XXX TODO BUG: This is not yet supported. The precise eabling
     * conditions are not yet determined, and neither is the implied
     * bookkeeping. 
     */
    function deleteProp(that,name) {
        require(canSetProp(that,name), 'not deleteable: ' + name);
        require(false, 'XXX deletion not yet supported');
        return require(delete that[name], 'not deleted: ' + name);
    }

    /**
     * A client of obj can only delete a property of obj if obj is a
     * non-frozen JSON container.
     * <p>
     * XXX TODO BUG: This is not yet supported. The precise eabling
     * conditions are not yet determined, and neither is the implied
     * bookkeeping. 
     */
    function deletePub(obj,name) {
        require(canSetPub(obj,name), "can't delete: " + name);
        require(isJSONContainer(obj), 'unable to delete: ' + name);
        require(false, 'XXX deletion not yet supported');
        return require(delete obj[name], 'not deleted: ' + name);
    }

    /** A Caja <tt>new</tt> call translates into a call to
     * <tt>callNew</tt>, which, in turn, calls the constructor
     * function so that a valid Caja constructor will proceed but a
     * valid Caja method will not.
     */
    function callNew(Constr,args) {
        require(!isMethod(Constr), "Can't 'new' a method");
        var result = Constr.apply___(makeRaw(Constr), args);
        cookIfRaw(result); // remove RAW flag as soon as possible
        return result;
    }

    /**
     * On entry to a base (super-most) constructor, verify that we're
     * constructing a raw object of the correct type, and start
     * cooking the object, so that it's no longer raw.
     * <p>
     * Claim: Caja code cannot call a Caja constructor as a method, or
     * use a constructor to re-initialize an already constructed
     * object.
     */
    function enterBase(Constr,that) {
        require(that instanceof Constr, 'entering stolen constructor');
        require(cookIfRaw(that), "Can't call constructor as method");
    }

    /**
     * On entry to a derived constructor, verify that we're
     * constructing a raw object of the correct type.
     * <p>
     * A derived constructor must immediately delegate further
     * construction to its super constructor before doing any more on
     * its own. Therefore, the object cannot be touched until it
     * reaches the supermost constructor, which starts cooking it. By
     * the time any of the other constructors see it again, it's
     * already cooking.
     */
    function enterDerived(Constr,that) {
        require(that instanceof Constr, 'entering stolen constructor');
        require(isRaw(that), "Can't call constructor as method");
    }

    /**
     * On entry to a method, verify that this method has been called
     * as a method on a cooked or cooking object (a non-raw object) of
     * the expected type.
     */
    function enterMethod(meth,that) {
        require(isMethodOf(meth,that), 'entering stolen method');
        require(!cookIfRaw(that), "Can't call method as constructor");
    }

    /**
     * The returns a frozen array copy of the original array or
     * array-like object.
     * <p>
     * If a Caja program makes use of <tt>arguments</tt> in any
     * position other than <tt>arguments.callee</tt>, this is
     * rewritten to use a frozen array copy of arguments instead. This
     * way, it Caja code passes its arguments to someone else, they
     * are not giving the receiver the rights to access the passing
     * function nor to modify the parameter variables of the passing
     * function.
     */
    function args(original) {
        return freeze(Array.prototype.slice.call___(original,0));
    }

    /**
     * Given that Sub and Sup are both constructors, that Sub isn't
     * frozen, and that Sub's 'Super' property isn't already set, set
     * Sub's 'Super' to Sup.
     * <p>
     * Outside this module, this should only be called by Javascript
     * initialization/taming code to declare such preexisting
     * relationships between Javascript constructors.
     */
    function setSuper(Sub,Sup) {
        requireType(Sub,'function');
        require(!isMethod(Sub),"A method can't inherit");
        requireType(Sup,'function');
        require(!isMethod(Sup,"Can't inherit from a method"));
        if (hasOwnProp(Sub,'Super')) {
            require(Sub.Super === Sup,"Can't inherit twice");
        } else {
            require(!isFrozen(Sub),'Sub constructor already frozen');
            // XXX possible vulnerability: setSuper does *not* mark Sub as
            // a constructor, so that a pure function can be on the left
            // of a def and can be a pseudo-method, such as
            // Brand(foo).seal(..).
            //
            // Sub.___CONSTRUCTOR___ = true;
            Sub.Super = Sup;
        }
    }

    /**
     * Provides a shorthand for a class-like declaration of a fresh
     * Caja constructor.
     * <p>
     * Given that Sub is a Caja constructor in formation, whose 'prototype'
     * property hasn't been initialized yet, initialize Sub and its
     * 'prototype' property so that it acts as a subclass of opt_Sup,
     * with opt_members added as members to Sub.prototype, and
     * opt_statics added as members to Sub. Finally, freeze
     * Sub.prototype and Sub itself.
     */
    function def(Sub,opt_Sup,opt_members,opt_statics) {
        var Sup = opt_Sup || Object;
        var members = opt_members || {};
        var statics = opt_statics || {};
        require(!('Super' in statics),
                'The static name "Super" is reserved '+
                'for the super-constructor');

        setSuper(Sub,Sup);
        function PseudoSuper() {}
        PseudoSuper.prototype = Sup.prototype;
        Sub.prototype = new PseudoSuper();
        Sub.prototype.constructor = Sub;

        for (var mname in members) {
            if (canEnumPub(members,mname)) {
                // XXX Possible vulnerability: setProp vs setPub
                setProp(Sub.prototype,mname,readPub(members,mname));
            }
        }
        for (var sname in statics) {
            if (canEnumPub(statics,sname)) {
                // XXX Possible vulnerability: setProp vs setPub
                setProp(Sub,sname,readPub(statics,sname));
            }
        }
        freeze(Sub.prototype);
        freeze(Sub);

        // TODO return a builder object that allows further initialization.
    }

    /**
     * Whitelist constr.prototype[name] as a method that can be called
     * on instances of Constr.
     */
    function allowMethod(Constr,name) {
        allowRead(Constr.prototype,name);
        method(Constr,Constr.prototype[name],name);
    }

    /**
     * Replace the pre-existing Constr.prototype[name] with meth,
     * whitelist it, and make the original available to meth as
     * meth.___ORIGINAL___. 
     * <p>
     * This last step is only useful, of course, if meth is written in
     * Javascript, not Caja. 
     */
    function wrapMethod(Constr,name,meth) {
        require(name in Constr.prototype, 'missing: ' + name);
        var original = Constr.prototype[name];
        if ('___ORIGINAL___' in original) {
            // In case we're reloading, preserve the real original
            // while forgetting the previous wrapper. (This case
            // probably only comes up during development.)
            original = original.___ORIGINAL___;
        }
        meth.___ORIGINAL___ = original;
        Constr.prototype[name] = meth;
        allowMethod(Constr,name);
    }

    /**
     * Replace Constr.prototype[name] with a wrapper that first
     * verifies that <tt>this</tt> isn't frozen.
     * <p>
     * When a pre-existing Javascript method would mutate its object,
     * we need to wrap it to prevent such mutation from violating Caja
     * semantics.
     */
    function allowMutator(Constr,name) {
        wrapMethod(Constr,name, function newMeth(varargs) {
            require(!isFrozen(this), "Can't " + name + ' a frozen object');
            return newMeth.___ORIGINAL___.apply___(this,arguments);
        });
    }

    /**
     * Verifies that regexp is something that can appear as a
     * parameter to a Javascript method that would use it in a match.
     * <p>
     * Of it is a RegExp, then this match might mutate it, which must
     * not be allowed if regexp is frozen.
     */
    function requireMatchable(regexp) {
        if (regexp instanceof RegExp) {
            require(!isFrozen(regexp), "Can't match with frozen RegExp");
        }
    }

    /**
     * A shorthand that happens to be useful here.
     * <p>
     * For all i in arg2s: func2(arg1,arg2s[i]).
     */
    function all2(func2,arg1,arg2s) {
        var i;
        var len = arg2s.length;
        for (var i = 0; i < len; i += 1) {
            func2(arg1,arg2s[i]);
        }
    }

    function Useless() {}
    freeze(Useless.prototype);
    var USELESS = freeze(new Useless());

    all2(allowRead,Math,[
        'E','LN10','LN2','LOG2E','LOG10E','PI','SQRT1_2','SQRT2',
        'abs','acos','asin','atan','atan2','ceil','cos','exp','floor',
        'log','max','min','pow','random','round','sin','sqrt','tan'
    ]);

    
    ctor(Object,undefined,'Object');
    all2(allowMethod,Object,[
        'toString','toLocaleString','valueOf','isPrototypeOf'
    ]);
    allowRead(Object.prototype,'length');
    wrapMethod(Object,'hasOwnProperty', function(name) {
        return canReadPub(this,name) && hasOwnProp(this,name);
    });
    wrapMethod(Object,'propertyIsEnumerable', function pie(name) {
        return canReadPub(this,name) && pie.___ORIGINAL___.call___(this,name);
    });


    ctor(Function,Object,'Function'); // seems dangerous, but doesn't add risk
    allowRead(Function.prototype,'prototype');
    allowMethod(Function,'apply');
    allowMethod(Function,'call');


    ctor(Array,Object,'Array');
    all2(allowMethod,Array,[
        'concat','join','slice','indexOf','lastIndexOf'
    ]);
    all2(allowMutator,Array,[
        'pop','push','reverse','shift','sort','splice','unshift'
    ]);


    ctor(String,Object,'String');
    allowRead(String,'fromCharCode');
    all2(allowMethod,String,[
        'charAt','charCodeAt','concat','indexOf','lastIndexOf',
        'localeCompare','slice','substring',
        'toLowerCase','toLocaleLowerCase','toUpperCase','toLocaleUpperCase'
    ]);
    wrapMethod(String,'match', function match(regexp) {
        requireMatchable(regexp);
        return match.___ORIGINAL___.call___(this,regexp);
    });
    wrapMethod(String,'replace', function replace(searchValue,replaceValue) {
        requireMatchable(searchValue);
        return replace.___ORIGINAL___.call___(this,searchValue,replaceValue);
    });
    wrapMethod(String,'search', function search(regexp) {
        requireMatchable(regexp);
        return search.___ORIGINAL___.call___(this,regexp);
    });
    wrapMethod(String,'split', function split(separator,limit) {
        requireMatchable(separator);
        return split.___ORIGINAL___.call___(this,separator,limit);
    });


    ctor(Boolean,Object,'Boolean');


    ctor(Number,Object,'Number');
    all2(allowRead,Number,[
        'MAX_VALUE','MIN_VALUE','NaN','NEGATIVE_INFINITY','POSITIVE_INFINITY'
    ]);
    all2(allowMethod,Number,[
        'toFixed','toExponential','toPrecision'
    ]);

    
    ctor(Date,Object,'Date');
    allowRead(Date,'parse');
    allowRead(Date,'UTC');

    all2(allowMethod,Date,[
        'toDateString','toTimeString','toUTCString',
        'toLocaleString','toLocaleDateString','toLocaleTimeString',
        'toISOString',
        'getDay','getUTCDay','getTimezoneOffset',

        'getTime','getFullYear','getUTCFullYear','getMonth','getUTCMonth',
        'getDate','getUTCDate','getHours','getUTCHours',
        'getMinutes','getUTCMinutes','getSeconds','getUTCSeconds',
        'getMilliseconds','getUTCMilliseconds',
    ]);
    all2(allowMutator,Date,[
        'setTime','setFullYear','setUTCFullYear','setMonth','setUTCMonth',
        'setDate','setUTCDate','setHours','setUTCHours',
        'setMinutes','setUTCMinutes','setSeconds','setUTCSeconds',
        'setMilliseconds','setUTCMilliseconds',
    ]);


    ctor(RegExp,Object,'RegExp');
    allowMutator(RegExp,'exec');
    allowMutator(RegExp,'test');

    all2(allowRead,RegExp,[
        'source','global','ignoreCase','multiline','lastIndex'
    ]);
    

    ctor(Error,Object,'Error');
    allowRead(Error,'name');
    allowRead(Error,'message');
    ctor(EvalError,Error,'EvalError');
    ctor(RangeError,Error,'RangeError');
    ctor(ReferenceError,Error,'ReferenceError');
    ctor(SyntaxError,Error,'SyntaxError');
    ctor(TypeError,Error,'TypeError');
    ctor(URIError,Error,'URIError');
    

    caja = freeze({
        require: require,
        requireType: requireType,
        requireNat: requireNat,

        directConstructor: directConstructor,
        isJSONContainer: isJSONContainer,
        isFrozen: isFrozen,
        freeze: freeze,
        isCtor: isCtor,
        isMethod: isMethod,
        isMethodOf: isMethodOf,

        canReadPub: canReadPub,
        readPub: readPub,
        canEnumPub: canEnumPub,
        canSetPub: canSetPub,
        setPub: setPub,
        deletePub: deletePub,

        def: def,
    });

    var whitelist = {
        caja: caja,

        null: null,
        false: false,
        true: true,
        NaN: NaN,
        Infinity: Infinity,
        undefined: undefined,
        parseInt: parseInt,
        parseFloat: parseFloat,
        isNaN: isNaN,
        isFinite: isFinite,
        decodeURI: decodeURI,
        decodeURIComponent: decodeURIComponent,
        encodeURI: encodeURI,
        encodeURIComponent: encodeURIComponent,
        Math: Math,

        Object: Object,
        Array: Array,
        String: String,
        Boolean: Boolean,
        Number: Number,
        Date: Date,
        RegExp: RegExp,
        
        Error: Error,
        EvalError: EvalError,
        RangeError: RangeError,
        ReferenceError: ReferenceError,
        SyntaxError: SyntaxError,
        TypeError: TypeError,
        URIError: URIError
    };

    for (var k in whitelist) {
        if (hasOwnProp(whitelist,k)) {
            var v = whitelist[k];
            switch (typeof v) {
            case 'object':
                if (v !== null) { freeze(v); }
                break;
            case 'function':
                freeze(v);
                freeze(v.prototype);
                break;
            }
        }
    }
    freeze(whitelist);

    ___ = freeze({
        require: require,
        requireType: requireType,
        requireNat: requireNat,

        hasOwnProp: hasOwnProp,
        directConstructor: directConstructor,
        isJSONContainer: isJSONContainer,
        isFrozen: isFrozen,
        freeze: freeze,
        canRead: canRead,
        canEnum: canEnum,
        canSet: canSet,
        allowRead: allowRead,
        allowEnum: allowEnum,
        allowSet: allowSet,
        isCtor: isCtor,
        isMethod: isMethod,
        isMethodOf: isMethodOf,
        ctor: ctor,
        method: method,
        module: module,
        wrapMethod: wrapMethod,
        makeRaw: makeRaw,
        isRaw: isRaw,
        cookIfRaw: cookIfRaw,

        canReadProp: canReadProp,
        readProp: readProp,
        canReadPub: canReadPub,
        readPub: readPub,
        canEnumProp: canEnumProp,
        canEnumPub: canEnumPub,
        canSetProp: canSetProp,
        setProp: setProp,
        canSetPub: canSetPub,
        setPub: setPub,
        deleteProp: deleteProp,
        deletePub: deletePub,

        callNew: callNew,
        enterBase: enterBase,
        enterDerived: enterDerived,
        enterMethod: enterMethod,
        args: args,

        setSuper: setSuper,
        def: def,
        
        allowMethod: allowMethod,
        wrapMethod: wrapMethod,
        allowMutator: allowMutator,
        requireMatchable: requireMatchable,
        all2: all2,

        USELESS: USELESS
    });
})();
