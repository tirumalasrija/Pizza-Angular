(function (angular) {
    'use strict';
    return angular.module('ph.app.menu')
        .directive('phTile', ['$log', '$state', 'APP_CONFIG', '$q', 'MenuService', 'PizzaBuilderService', 'PhUtils', '$popover', 'ResponsiveUtility', '$rootScope', 'PbModalService','ModalService', 'AccountService', 'OrderService', 'snapRemote', '$timeout','$sce','$window',
            function ($log, $state, CONFIG, $q, MenuService, PizzaBuilderService, PhUtils, $popover, ResponsiveUtility, $rootScope, PbModalService,ModalService, AccountService, OrderService, snapRemote, $timeout,$sce,$window) {
                var EMPTY_VAL = CONFIG.TILE_DATA.SUS_EMPTY_VALUE;
                var variant, product_click_dataLayer = {};

                function initializeSUSClasses(hidden) {
                    var classes = {};
                    for (var i = 0, len = hidden.length, field; i < len; ++i) {
                        field = hidden[i];
                        if (CONFIG.TILE_DATA.SUS_CLASSES.indexOf(field.name) != -1) {
                            classes[field.name] = field.value !== "" ? field.value : EMPTY_VAL;
                        }
                    }
                    return classes;
                }

                function getRadioButtons(options) {
                    var field = [];
                    for (var i = 0, len = options.length; i < len; ++i) {
                        field[i] = options[i].val;
                    }
                    return field;
                }

                function updatePizzaPrice(data, crust, size) {
                    var iter = data;
                    var ary = [crust, size];
                    for (var i = 0, len = ary.length; i < len; ++i) {
                        if (iter && iter.hasOwnProperty(ary[i])) {
                            iter = iter[ary[i]];
                        }
                    }
                    return iter;
                }


                function setToEmptyValue(ary) {

                    for (var j = 0, len = ary.length; j < len; ++j) {
                        var value = ary[j];
                        if (!(/^[a-zA-Z]+$/.test(value))) {
                            ary[j] = EMPTY_VAL;
                        }
                    }
                    var temp = ary[2]; //swaping is done for arranging the array in order as [class, prod,size,topp,base]
                    ary[2] = ary[1];
                    ary[1] = temp;
                    return ary;
                }

                function updateGenericPrice($scope, data, classes, prod, size, topp, base, product_code) {

                    var iter = data;
                    var ary = (product_code)?setToEmptyValue(product_code.split('-')):[PhUtils.processEmptyString(prod) || classes.prod || EMPTY_VAL,
                        PhUtils.processEmptyString(size) || classes.size || EMPTY_VAL,
                        PhUtils.processEmptyString(topp) || classes.topp || EMPTY_VAL,
                        PhUtils.processEmptyString(base) || classes.base || EMPTY_VAL
                    ];

                        for (var i = 0, len = ary.length; i < len; ++i) {
                            if (iter && iter.hasOwnProperty(ary[i])) {
                                iter = iter[ary[i]];
                            }
                        }

                    if($scope.item.source === 'upsell' && $scope.item.source !== undefined) {
                        if(prod !== 'default_text' && (size !== 'default_text' || $scope.item.selects[0].options.length === 2) ){
                            if (iter.code === undefined) {
                                for (var key in iter) {
                                    var obj = iter[key];
                                    for (var prop in obj) {
                                        if (obj.hasOwnProperty(prop)) {
                                            iter = obj[prop];
                                            var breaking = false;
                                            if (prop === topp) {
                                                breaking = true;
                                            }
                                            for (var prop2 in iter) {
                                                if (iter.hasOwnProperty(prop2)) {
                                                    iter = iter[prop2];
                                                    if (breaking) {
                                                        return iter;
                                                    }
                                                }
                                            }
                                        }
                                    }
                                }
                            }
                        }
                    }
                    return iter;
                }

                function clearDisabled(options) {
                    if (options && options.length) {
                        for (var i = 0, len = options.length; i < len; ++i) {
                            if(options[i].val === 'default_text'){
                                options[i].isDisabled = true;
                            }else{
                                options[i].isDisabled = false;
                            }
                        }
                    }
                }

                function setInitialValue(options){
                    if (options && options.length === 2) {
                        for (var i = 0, len = options.length; i < len; ++i) {

                            if(options[i].val === 'default_text'){
                                options[i].selected = options[1].val;
                            }else{
                                options[i].selected = options[i].val;
                            }
                        }
                        return options;
                    }
                }

                function checkLowestPrice(options, wingsPrices) {
                    var lowest_price,wingsPriceArr = [];
                    if (options && options.length) {
                        for (var i = 0, len = options.length; i < len; ++i) {
                            if(options[i].val !== 'default_text'){
                                wingsPriceArr.push(wingsPrices[options[i].val].price) ;
                            }
                        }
                        lowest_price = Math.min.apply(Math, wingsPriceArr);

                    }

                    return lowest_price;
                }


                //To handle error message if dropdown has default text selected
                function alertSubmitOrder(msg, isVCOOffer) {
                    var title;
                    if(isVCOOffer === 'VCO Offer'){
                        title = " ";
                    }else{
                        title = "A FEW MORE CHOICES";
                    }
                    var scope = {
                        title: title,
                        button: "OK",
                        message: msg
                    };
                    ModalService.open(undefined, CONFIG.PARTIALS.MODAL.ALERT, scope, 'md').result.then(function () {
                        if(isVCOOffer === 'VCO Offer'){
                            $state.go('index.home');
                        }
                    }, function (reject) { //same for reject also
                    });
                }

                function updateDisabled(allowed, options,scope,selectedCrust) {
                    if (allowed && allowed.length && options.length) {
                        for (var i = 0, len = options.length; i < len; ++i) {
                            options[i].isDisabled = allowed.indexOf(options[i].val) === -1;
                        }
                    }else{
                        if (allowed && allowed.length===0 && options.length) {
                            for (var i1 = 0, len1 = options.length; i1 < len1; ++i1) {
                                options[i1].isDisabled = allowed.indexOf(options[i1].val) === -1;
                            }
                        }
                    }
                    setOOPCrust(scope,selectedCrust);
                }

                function updateCrustDisable(allowed, options) {

                    for (var i = 0, len = options.length; i < len; ++i) {
                        if (allowed && allowed.length) {
                            for (var j = 0, disLen = allowed.length; j < disLen; ++j) {
                                if (allowed[j]=== options[i].val) {
                                    options[i].isDisabled = true;
                                }
                            }
                        }
                    }
                }



                //disabling dropdown selections when the product is not available
                function updateDisabledOther(matchFound, options){
                    var field;
                    if (matchFound && matchFound.length && options.length) {
                        for (var x = 0, lenx = options.length; x < lenx; ++x) {
                            field = options[x].text;
//                            if(field.indexOf("No option") >= 0 || field.indexOf("No Dip") >= 0 ||
//                                field.indexOf("Select") >= 0 || field.indexOf("How many") >= 0 || field.indexOf("Choose a flavor") >= 0) {
//                                options[x].isDisabled=true;
//                            }else {
                            options[x].isDisabled = matchFound.indexOf(options[x].val) === -1;
                            // }
                        }
                        //this fixes the empty option being added to the dropdown
                    }else if(options.length){
                        for (var i = 0, len = options.length; i < len; ++i) {
                            field = options[i].text;
                            if (field.indexOf("No option") >= 0 ||
                                field.indexOf("No Dip") >= 0 ||
                                field.indexOf("Select") >= 0 ||
                                field.indexOf("How") >= 0 ||
                                field.indexOf("Select") >= 0 ||
                                field.indexOf("Choose") >= 0||
                                field.indexOf("What") >= 0) {
                                options[i].isDisabled = false;
                            } else {
                                options[i].isDisabled = true;
                            }
                        }
                    }
                    return options;
                }

                //disabling the first value in the dropdown if the first value is set with default text
                function disabledFirstValue(options){
                    var field, value;
                    for (var x = 0, lenx = options.length; x < lenx; ++x) {
                        field = options[x].text;
                        value = options[x].val;
                        if((field.indexOf("No") >= 0 ||
                            field.indexOf("Select") >= 0 ||
                            field.indexOf("How") >= 0 ||
                            field.indexOf("Select") >= 0 ||
                            field.indexOf("Choose") >= 0 ||
                            field.indexOf("What") >= 0) &&
                            value === 'default_text' || value === '') {
                            options[x].isDisabled=true;
                        }else{
                            options[x].isDisabled=false;
                        }
                    }
                    return options;
                }


                //ibhaidani -filtering three dropdowns-
                //Iterate thru JSON object to find the selected key.
                //If the key matches the items in the second dropdown, then added it to matchFound array
                // if the items in matchFound are not available in the dropdown list, the those items will be disabled
                // then iterate thru the next set to find a matching key for the third dropdown and disable if it's not in the list
                function updateDisableThree(scope){
                    var mjson = scope.item.tile_data.hierarchy;
                    var matchFound1 = [];
                    var matchFound2 = [];

                    for (var key in mjson) {
                        var obj = mjson[key];
                        if(key===scope.selected.prod){
                            for(var key2 in obj){
                                matchFound1.push(key2);
                                var obj2 = obj[key2];
                                for (var key3 in obj2) {
                                    if (key3 != "_empty_" && key2===scope.selected.size) {
                                        matchFound2.push(key3);
                                    }
                                }
                            }
                        }
                    }

                    var select1 = scope.item.selects[1].options;
                    var select2 = scope.item.selects[2].options;

                    select1 = updateDisabledOther(matchFound1, select1);
                    select2 = updateDisabledOther(matchFound2, select2);

                    var options = [select1, select2];
                    return options;
                }

                //ibhaidani -filtering two (non-pizza) dropdowns-
                // Iterate thru JSON object to find the selected key.
                // If the key matches the items in the second dropdown, then added it to matchFound array.
                // If the items in matchFound are not available in the dropdown list, then those items will be disabled.
                function updateDisableOther(scope, p, s, sel, x){
                    if(scope.item.selects[x] !== undefined) {
                        var iter = scope.item.tile_data.hierarchy;
                        var iter2 = scope.item.selects[x].options;
                        var matchFound = [];

                        var ary = [p || s];
                        for (var i = 0, lenb = ary.length; i < lenb; ++i) {
                            if (iter && iter.hasOwnProperty(ary[i])) {
                                iter = iter[ary[i]];
                            }
                        }

                        //filtering product and size dropdowns
                        if(sel==="ps") {
                            for (var key in iter) {
                                var obj = iter[key];
                                for (var key2 in iter2) {
                                    var obj2 = iter2[key2];
                                    if (key === obj2.val) {
                                        matchFound.push(key);
                                        //break or return here
                                        break;
                                    }
                                }
                            }
                        }else if(sel==="pt") {
                            for (var key3 in iter) {
                                var obj3 = iter[key3];
                                for (var key4 in obj3) {
                                    for (var key5 in iter2){
                                        var obj5 = iter2[key5];
                                        if (key4 === obj5.val) {
                                            matchFound.push(key4);
                                            //break or return here
                                            break;
                                        }
                                    }
                                }
                            }
                        }else if(sel==="SL") {
                            for (var key16 in iter) {
                                var obj16 = iter[key16];
                                for(var key17 in obj16) {
                                    var obj17 = obj16[key17];
                                    for (var key19 in iter2) {
                                        var obj19 = iter2[key19];
                                        if (key17 === obj19.val) {
                                            matchFound.push(key17);
                                            break;
                                        }
                                    }
                                }
                            }
                        }


                        var options = scope.item.selects[x].options;
                        options = updateDisabledOther(matchFound, options);

                        if(scope.selected.size === s && scope.selected.size !== 'default_text') {
                            for (var sizeKey in options) {
                                if (scope.selected.size === options[sizeKey].val && options[sizeKey].isDisabled) {
                                    scope.selected.size = scope.firstNonDisabled(options);
                                }
                            }
                        } else if (scope.selected.topp === s) {
                            for (var toppKey in options) {
                                if (scope.selected.topp === options[toppKey].val && options[toppKey].isDisabled) {
                                    scope.selected.topp = scope.firstNonDisabled(options);
                                }
                            }
                        }

                        return options;
                    }
                }

                function handleCrustChange(scope, n, o) {
                    if (scope.allowed.crusts.hasOwnProperty(n)) {
                        updateDisabled(scope.allowed.crusts[n], scope.item.sizes,scope,n);
                        scope.selected.size = scope.firstNonDisabled(scope.item.sizes);
                    } else {
                        clearDisabled(scope.item.sizes);
                    }
                }

                function setOOPCrust(scope,selectedCrust){
                    var disabledCrust=[];
                    if (scope.allowed && scope.allowed.crusts) {
                        for (var crust in scope.allowed.crusts) {
                            if(scope.allowed.crusts.hasOwnProperty(crust) && scope.allowed.crusts[crust].length===0){
                                disabledCrust.push(crust);
                                if(selectedCrust===crust){
                                    setNonOOPCrust(scope);
                                }
                            }
                        }
                        updateCrustDisable(disabledCrust,scope.item.crusts);
                    }
                }

                function setNonOOPCrust(scope) {
                    if (scope.allowed && scope.allowed.crusts){
                        for(var crust in scope.allowed.crusts){
                           if(scope.allowed.crusts.hasOwnProperty(crust) && scope.allowed.crusts[crust].length!==0){
                               scope.selected.crust=crust;
                               break;
                           }
                        }
                    }
                }

                function displayShortDescription(description, title, $scope) {
                    var textCount;
                    if (ResponsiveUtility.viewport.isMWide()) {
                        if(title && title.length >= 30){
                            textCount = 70;
                        }else{
                            textCount = 160;
                        }
                    } else if (ResponsiveUtility.viewport.isTWide() && !(ResponsiveUtility.viewport.isLarge())) {
                        if(title && title.length >= 60){
                            textCount = 150;
                        }else{
                            textCount = 180;
                        }

                    } else if (ResponsiveUtility.viewport.isMNarrow()) {
                        if (ResponsiveUtility.viewport.isMNarrow_320()) {
                            if (title && title.length >= 19) {
                                textCount = 40;
                            } else {
                                textCount = 85;
                            }
                        }else if(ResponsiveUtility.viewport.isMNarrow_360()){
                            if (title && title.length >= 22) {
                                textCount = 50;
                            } else {
                                textCount = 90;
                            }
                        }else if(ResponsiveUtility.viewport.isMNarrow_384()){
                            if (title && title.length >= 22) {
                                textCount = 60;
                            } else {
                                textCount = 100;
                            }
                        }else if(ResponsiveUtility.viewport.isMNarrow_420()){
                            if (title && title.length >= 25) {
                                textCount = 60;
                            } else {
                                textCount = 105;
                            }
                        }
                    }else if (ResponsiveUtility.viewport.isTNarrow()) {
                        if(title && title.length >= 20){
                            textCount = 50;
                        }else{
                            textCount = 90;
                        }
                    }else if(ResponsiveUtility.viewport.isLarge()){
                        if(title && title.length >= 80){
                            textCount = 160;
                        }else{
                            textCount = 190;
                        }
                    }

                    //when the title is long, only show 20 character of the product description, so the 'more' won't overlap with the 'order now' area

                    if (description && description.length > textCount) {
                        var nextstrpos = parseInt(textCount + 1);
                        if (description.charAt(nextstrpos) === '') {
                            $scope.tempdescription = description.substr(0, nextstrpos);
                            $scope.shortDescription = $sce.trustAsHtml($scope.tempdescription);
                            $scope.displayMoreText = false;
                        } else {
                            for (var pos = textCount - 1; pos > 1; pos--) {
                                if (description.charAt(pos) === ' ') {
                                    $scope.tempdescription = description.substr(0, pos);
                                    $scope.shortDescription = $sce.trustAsHtml($scope.tempdescription);
                                    $scope.displayMoreText = true;
                                    break;
                                }
                            }

                        }

                    } else {
                        $scope.tempdescription = description;
                        $scope.shortDescription = $sce.trustAsHtml($scope.tempdescription);
                        $scope.displayMoreText = false;
                    }
                }

                function setDefaultPanPasta(defaults, opitional) {
                    var pastaDefaults = {};
                    for (var x in opitional) {
                            if(opitional[x].code===defaults.option){
                                pastaDefaults={
                                    topp:parseInt(x)+1,
                                    option:(defaults.base)?defaults.option:''
                                };
                            }
                    }
                    return pastaDefaults;
                }

                function productClick(item, selected, price){
                    var variant = '', i, j;
                    
                    if(item.optionalPan){
                        //pasta tile... needs to be handled differently
                        if(selected.topp && selected.topp === '2'){
                            variant = 'Cheese Sticks';
                        }
                        if(selected.addPan && selected.secondPan){
                            for (i = 0; i < item.optionalPan.length; i++) { 
                                if(item.optionalPan[i].code === selected.secondPan){
                                    if(variant !== ''){
                                        variant += ", ";
                                    }
                                    variant += item.optionalPan[i].descShort;
                                }
                            }
                        }
                    } else {
                        //Product tile that is NOT a pasta tile.
                        //Capture variant as a comma delimited list of choices on any interaction
                        if(item.selects){
                            for (i = 0; i < item.selects.length; i++) {
                                if(selected.hasOwnProperty(item.selects[i].name) && selected[item.selects[i].name] !== 'default_text'){
                                    for (j = 0; j < item.selects[i].options.length; j++) {
                                        if(item.selects[i].options[j].val === selected[item.selects[i].name]){
                                            if(variant !== ''){
                                                variant += ", ";
                                            }
                                            variant += item.selects[i].options[j].text;
                                        }
                                    }
                                }
                            }
                        }
                    }

                    submitDataLayer(variant, item.analytics, price);

                }

                function multiClassProductClick(analytics, options, selected){
                    for (var sel in options){
                        if(options[sel].val===selected){
                            analytics.name=options[sel].text;
                            analytics.id=selected;
                        }
                    }

                    analytics.id = analytics.id.replace(/-/g, '~');
                    if(typeof analytics.list == 'undefined'){
                        analytics.list = $rootScope.last_list;
                    }
                    var mProductClick_dataLayer = {
                        'event': 'productClick',
                        'ecommerce': {
                            'click': {
                                'actionField': {'list': analytics.list},
                                'products': {
                                    'name': analytics.name,
                                    'id': analytics.id,
                                    'price': analytics.price,
                                    'category': analytics.category,
                                    'variant': ''
                                }
                            }
                        }
                    };
                    $window.dataLayer.push(mProductClick_dataLayer);
                    product_click_dataLayer = {};
                }

                function pizzaProductClick(analytics, option, selected, tileData, price){
                    var pizzaVariant;

                    if(option==='crust'){
                        var crustList = tileData;
                        for (var crust in crustList) {
                            if (selected === crustList[crust].val) {
                                pizzaVariant = crustList[crust].text;
                            }
                        }
                    } else if(option==='size'){
                        var sizeList = tileData;
                        for (var size in sizeList) {
                            if (selected === sizeList[size].val) {
                                pizzaVariant = sizeList[size].text;
                            }
                        }
                    }

                    if(pizzaVariant){
                        submitDataLayer(pizzaVariant, analytics, price);
                    }
                }

                function setPastaPrice(data, topp){
                    var count=0,price={};
                    for (var x in data) {
                        count++;
                        if (angular.isObject(data[x]) && count === parseInt(topp)){
                            price = {
                                price:data[x].price,
                                code:x
                            };
                        }
                    }
                    return price;
                }


                function setPastaAddPanPrice(baseprice, data, pan) {
                    var finalPrice;
                    for (var x in data) {
                        if (angular.isObject(data[x]) && pan === x){
                            finalPrice = parseInt(baseprice) + parseInt(data[x].price)+'.00';
                        }
                    }
                    return finalPrice;
                }

                function submitDataLayer(variant, analytics, price){
                    if(analytics){
                        if(typeof analytics.list == 'undefined'){
                            analytics.list = $rootScope.last_list;
                        }
                        var product_click_dataLayer = {
                            'event': 'productClick',
                            'ecommerce': {
                                'click': {
                                    'actionField': {'list': analytics.list},
                                    'products': PhUtils.GCCommonObjects(analytics.name,analytics.id,price,
                                        analytics.category,variant,"")
                                }
                            }
                        };
                        $window.dataLayer.push(product_click_dataLayer);
                        product_click_dataLayer = {};
                    }
                }

                return {
                    restrict: 'EA',
                    transclude: false,
                    templateUrl: 'scripts/components/menu/tile.tpl.html',
                    scope: {
                        item: '=item',
                        auto: '=auto',
                        add: '=add',
                        changetab:'=changetab',
                        types: '=types',
                        page: '=page',
                        localized: '=localized',
                        skinny: '=skinny',
                        gluten:'=gluten',
                        sortby:'=sortby',
                        sections:'=sections',
                        dropval:'=dropval',
                        isEditItem:"=isEditItem",
                        position: '=position'
                    },
                    controller: ['$scope', '$state',
                        function ($scope, $state) {
                            $scope.selected = {};
                            $scope.quantities = PhUtils.dropDownGenerator();
                            $scope.img_root = CONFIG.TILE_IMAGE_ROOT;
                            $scope.default_image = CONFIG.TILE_DEFAULT_IMAGE;
                            $scope.tile_interstitial = false;

                            /*ibhaidani:
                             code below is a for Wings tile only.
                             JSON returned from the API has flavor and size selections
                             but the order needs to be swapped so it displays
                             size on the left and flavor on the right
                             */

                            if($scope.item && $scope.item.class==="WS" && ($scope.isEditItem === 'editItem' || $scope.isEditItem==="editDealItem" || $scope.item.subclss==="wings") &&
                                $scope.item.selects[1] && $scope.item.selects[1].name==="size" && $scope.item.selects[0].name==="prod"){
                                var selects = $scope.item.selects, x= 0, y= 1;
                                selects[x] = selects.splice(y, 1, selects[x])[0];
                                $scope.item.selects= selects;
                            }


                            function disableInterstitial () {
                                $scope.tile_interstitial = false;
                            }
                            function enableInterstitital (){
                                $scope.tile_interstitial = true;
                            }

                            if($scope.isEditItem === 'editDealItem'){
                                $scope.item.qty = 1;
                            }
                            if($scope.isEditItem){
                                getProductControllers();
                            }
                            function handleAddPromise(added){
                                // only if the add method passed in returns a promise
                                if(angular.isObject(added) && added.hasOwnProperty('then')){
                                    enableInterstitital();
                                    added.then(disableInterstitial, disableInterstitial);
                                }
                            }

                            if ($scope.types) {
                                $scope.allowed = {
                                    crusts: $scope.types.allowedCrusts,
                                    sizes: $scope.types.allowedSizes
                                };
                            }

                            if ($scope.auto) {
                                if ($scope.auto.description.length > 3) {
                                    displayShortDescription($scope.auto.description, $scope.auto.title, $scope);
                                } else {
                                    displayShortDescription($scope.auto.deal_items_desc, $scope.auto.title, $scope);
                                }
                            } else {
                                displayShortDescription($scope.item.description, $scope.item.title, $scope);
                            }
                            $scope.classes = $scope.item && $scope.item.hidden ? initializeSUSClasses($scope.item.hidden) : {};
                            /// This is For radio Buttons display
                            if ($scope.item && $scope.item.optionalPan) {
                                $scope.toppcode = [];
                                if ($scope.item.tile_data_aap && $scope.item.tile_data_aap.hierarchy && $scope.item.tile_data_aap.hierarchy.baseItemCode) {
                                    for (var code in $scope.item.tile_data_aap.hierarchy.baseItemCode) {
                                       if(angular.isObject($scope.item.tile_data_aap.hierarchy.baseItemCode[code]))
                                        $scope.toppcode.push({
                                            code:code,
                                            price:$scope.item.tile_data_aap.hierarchy.baseItemCode[code].price
                                        });
                                    }
                                }
                            }

                            //this for drop downs for disabling the fields list in it for pizza
                            if ($scope.page === 'pizza' || $scope.page === 'allupsell') {

                                $scope.$watch('selected.crust', function (n, o) {
                                    handleCrustChange($scope, n, o);
                                    $scope.__update();
                                });
                                $scope.$watch('selected.size', function () {
                                    $scope.__update();
                                });
                            }

                            //Pizza only  for Changing the tabs other
                            $scope.__productAdd=function(link, new_tab){

                                if(link.indexOf('http')!== -1){
                                    if(new_tab === '0'){
                                        window.location.href = link;
                                    }else if(new_tab === '1'){
                                        window.open(link);
                                    }
                                }else{
                                    var send= $scope.changetab(link,$scope.sections);
                                }

                            };

                            //reset resetDropdown to set it to 'No option' selection
                            $scope.resetDropdown = function (options) {
                                if (options && options.length) {
                                    for (var i = 0, len = options.length; i < len; ++i) {
                                        if (!options[i].isDisabled) {
                                            if(options[i].text!=="" && options[i].val===""){
                                                // options[i].val(options[i].text);
                                                return options[i].val;
                                            }
                                        }
                                    }
                                }
                            };

                            $scope.firstNonDisabled = function (options) {
                                if (options && options.length) {
                                    for (var i = 0, len = options.length; i < len; ++i) {
                                        if (!options[i].isDisabled) {
                                            // if(options[i].val!=="") {
                                            if(options[i].val!=="" && options[i].val!=="default_text" && options[i].val!=="No option") {
                                                return options[i].val;
                                            }else if(options[i].text.indexOf("No option") >= 0 ){
                                                return options[i].val;
                                            }
                                        }
                                    }
                                }
                            };


                            var tempP = "";
                            var tempS = "";
                            var tempB = "";
                            var tempT = "";
                            var tempCrust = "";
                            var tempSize = "";
                            var tempSelected;


                            $scope.__update = function (click) {

                                if ($scope.page === 'pizza' || $scope.page === 'allupsell' && $scope.item.tile_data.tile_class === "P") {
                                    if ($scope.item.tile_data && $scope.item.tile_data.prices) {
                                        $scope.pb = updatePizzaPrice($scope.types.pb_types, $scope.selected.crust, $scope.selected.size);
                                        $scope.calculated = {
                                            price: $scope.item.tile_data.prices[$scope.pb.code],
                                            code: $scope.pb.code
                                        };

                                        var crust = $scope.selected.crust;
                                        var size = $scope.selected.size;

                                        if(crust!==tempCrust && tempCrust) {
                                            pizzaProductClick($scope.item.analytics, 'crust', crust, $scope.item.crusts, $scope.calculated.price);
                                        }

                                        if(size!==tempSize && tempSize) {
                                            pizzaProductClick($scope.item.analytics, 'size', size, $scope.item.sizes, $scope.calculated.price);
                                        }

                                        tempCrust = crust;
                                        tempSize = size;

                                    }
                                } else {
                                    if ($scope.item && $scope.item.tile_data) {
                                        var p = $scope.selected.prod;
                                        var s = $scope.selected.size;
                                        var b = $scope.selected.base;
                                        var t = $scope.selected.topp;
                                        var options;

                                        if($scope.isEditItem ==="editItem"){
                                            var sel = document.getElementById("selectQty1");
                                            if(sel && sel.length){
                                                for(var x=0;x<sel.length;x++){
                                                    sel[x].setAttribute('class', 'drop_st');
                                                }
                                            }

                                            var sel2 = document.getElementById("selectQty2");
                                            if(sel2 && sel2.length) {
                                                for (var i = 0; i < sel2.length; i++) {
                                                    sel2[i].setAttribute('class', 'drop_st');
                                                }
                                            }
                                        }

                                        //select if length is 3
                                        if ($scope.item.selects && $scope.item.selects.length === 3){
                                            //if product dropdown was changed
                                            if(p!==tempP){
                                                //call updateDisableThree
                                                options = updateDisableThree($scope);

                                                //update the first dropdown w/ the first available option to select
                                                $scope.selected.size = $scope.firstNonDisabled(options[0]);

                                                //update the second dropdown w/ the first available option to select
                                                $scope.selected.topp = $scope.resetDropdown(options[1]);
                                            }
                                            //if size dropdown was changed
                                            if(s!==tempS && tempS) {
                                                //call updatedDisableThree
                                                options = updateDisableThree($scope);

                                                //update the third dropdown w/ the first available option to select
                                                var selectTopp2 = $scope.firstNonDisabled(options[1]);

                                                if(selectTopp2!==undefined){
                                                    $scope.selected.topp = selectTopp2;
                                                } else {
                                                    //if the first option to select is not a product, reset to 'No option'
                                                    //without this function, the dropdown ends up w/ a empty option
                                                    $scope.selected.topp = $scope.resetDropdown(options[1]);
                                                }
                                            }
                                            //select when there are two dropdowns
                                            //} else if($scope.item.selects && $scope.item.selects.length === 2 && p && s){
                                        } else if($scope.item.selects && $scope.item.selects.length === 2){
                                            //logic below resets the size dropdown if there are disabled options
                                            // when the user leaves the page and comes back to it
                                            //IF PHI decides not to use 'default_text' in the dropdowns on the tiles
                                            //code below will break. To fix this, we'll need to find another property to use.

                                            if( p || s){

                                                if(p && click === 'selected'){
                                                    disabledFirstValue($scope.item.selects[1].options);
                                                }else if(p === "default_text"){
                                                    // if there is only one option with default value
                                                    setInitialValue($scope.item.selects[0].options);
                                                }

                                                if(s  && click=== 'selected'){
                                                    disabledFirstValue($scope.item.selects[0].options);

                                                }else  if(s === "default_text"){
                                                    // clearDisabled($scope.item.selects[1].options);
                                                    // if there is only one option with default value
                                                    setInitialValue($scope.item.selects[1].options);
                                                }
                                            }

                                            //when in edit mode
                                            if($scope.isEditItem==='editItem'){
                                                updateDisableOther($scope, $scope.item.prod, $scope.item.size, "ps", 0);
                                                disabledFirstValue($scope.item.selects[1].options);

                                            }

                                            //if product was changed, filter thru and disable OOS products
                                            if(p!==tempP && tempP && p!=="default_text" && p && s && $scope.item.tile_data.tile_class!=='SL'){
                                                options = updateDisableOther($scope, p, s, "ps", 0);
                                            } else if(p!==tempP && tempP && p && t && $scope.item.tile_data.tile_class!=='SL') {
                                                options = updateDisableOther($scope, p, t, "pt", 1);
                                            } else if(p!=='' && t==='' && !tempT && $scope.item.tile_data.tile_class!=='SL') {
                                                options = updateDisableOther($scope, p, t, "pt", 0);
                                            } else if(p!==tempP && tempP && p!=="default_text" && p && t==="" && $scope.item.tile_data.tile_class!=='SL') {
                                                options = updateDisableOther($scope, p, t, "pt", 0);
                                            } else if ($scope.item.tile_data.tile_class==='SL' && p!==tempP){
                                                options = updateDisableOther($scope, p, t, "SL", 1);
                                                $scope.selected.topp = $scope.firstNonDisabled(options);
                                            }

                                            if($scope.item.wings_prices){
                                                $scope.lowestPiece = checkLowestPrice( $scope.item.selects[0].options, $scope.item.wings_prices) ;
                                            }

                                        }else if($scope.item.selects && $scope.item.selects.length === 1 && $scope.item.selects[0].options && $scope.item.selects[0].options.hasOwnProperty('val')){
                                            if($scope.item.selects[0].options[0].val === 'default_text'){
                                                disabledFirstValue($scope.item.selects[0].options);
                                            }
                                        }

                                        //setting the first size from the drop down list, if the first value is the default value,  to get the correct price
                                        if($scope.item.selects && $scope.item.selects[0]  && $scope.item.selects[0].options && $scope.item.selects[0].options.length === 2 && $scope.item.selects[0].options[0].hasOwnProperty('val')){
                                            if($scope.item.selects[0].options[0].val === 'default_text'){
                                                $scope.selected.size = $scope.item.selects[0].options[1].val;
                                            }
                                        }

                                        $scope.classes = $scope.item && $scope.item.hidden ? initializeSUSClasses($scope.item.hidden) : {};
                                        displayShortDescription($scope.item.description, $scope.item.title, $scope);

                                        if (!$scope.item.optionalPan) {
                                            $scope.calculated = updateGenericPrice($scope, $scope.item.tile_data.hierarchy, $scope.classes, $scope.selected.prod, $scope.selected.size, $scope.selected.topp, $scope.selected.base, $scope.selected.product_code);
                                        }
                                        else if (!$scope.selected.addPan && $scope.item.optionalPan) {

                                                $scope.selected.topp = ($scope.selected.topp) ? $scope.selected.topp : 1;
                                                $scope.calculated = setPastaPrice($scope.item.tile_data_aap.hierarchy.baseItemCode, $scope.selected.topp);

                                        } else {
                                            if (!$scope.selected.secondPan) {
                                                $scope.selected.topp = ($scope.selected.topp) ? $scope.selected.topp : 1;
                                                $scope.calculated = setPastaPrice($scope.item.tile_data_aap.hierarchy.baseItemCode, $scope.selected.topp);
                                            } else {
                                                var exactPrice, price1 = setPastaPrice($scope.item.tile_data_aap.hierarchy.baseItemCode, $scope.selected.topp);
                                                exactPrice = setPastaAddPanPrice(price1.price, $scope.item.tile_data_aap.hierarchy.addPanOpt, $scope.selected.secondPan);
                                                $scope.calculated = {
                                                    price: exactPrice,
                                                    base_product_code: price1.code,
                                                    code: $scope.selected.secondPan
                                                };
                                            }
                                        }

                                        var price;
                                        //i Data Layer
                                        if($scope.item.analytics && $scope.item.analytics.price ){
                                            price = $scope.item.analytics.price;
                                        }


                                        if($scope.calculated && $scope.calculated.price){
                                            price = $scope.calculated.price;
                                        }
                                        //prevent product clicks from firing on individual deal steps
                                        if(window.location.href.indexOf("/deal/") < 0 && click !== 'init'){                                
                                            if ($scope.item.multi_class && $scope.item.multi_class===true){
                                                multiClassProductClick($scope.item.analytics, $scope.item.selects[0].options, $scope.selected.product_code);
                                            } else {
                                                productClick($scope.item, $scope.selected, price);
                                            }
                                        }

                                        //end productClick

                                        tempP = p;
                                        tempS = s;
                                        tempT = t;
                                        tempB = b;
                                        tempSelected = $scope.selected;
                                    }
                                }
                            };

                            $scope.editItems = function(){
                                if(!ResponsiveUtility.viewport.isXSmall()){
                                    ModalService.dismissStack();
                                }
                                var editedResponse;
                                getProductControllers();
                                if(!$scope.calculated || !$scope.calculated.code){
                                    if($scope.item && $scope.item.class==="WS" && ($scope.item.selects[0] && $scope.item.selects[0].hasOwnProperty('options') && $scope.item.selects[0].options.length === 2 && $scope.selected.size==="default_text")){
                                        var wisize = ($scope.selected.size==="default_text") ? $scope.item.selects[0].options[1].val : $scope.selected.size,
                                            witop = $scope.item.topp,
                                            wibase = $scope.item.base,
                                            wiprod = ($scope.selected.prod==="default_text") ? $scope.item.prod : $scope.selected.prod;
                                        $scope.selected.size = wisize;
                                        $scope.calculated = updateGenericPrice($scope, $scope.item.tile_data.hierarchy, $scope.classes, wiprod, wisize, witop ,wibase);
                                    }
                                    else if($scope.item.class==="WS"){
                                        var wsize = ($scope.selected.size==="default_text") ? $scope.item.size : $scope.selected.size,
                                            wtop = $scope.item.topp,
                                            wbase = $scope.item.base,
                                            wprod = ($scope.selected.prod==="default_text") ? $scope.item.prod : $scope.selected.prod;
                                        $scope.selected.size = wsize;
                                        $scope.calculated = updateGenericPrice($scope, $scope.item.tile_data.hierarchy, $scope.classes, wprod, wsize, wtop ,wbase);
                                    }else {
                                        var size = $scope.selected.size ? $scope.selected.size : $scope.item.size,
                                            top = $scope.selected.topp ? $scope.selected.topp : $scope.item.topp,
                                            base = $scope.selected.base ? $scope.selected.base : $scope.item.base,
                                            prod = $scope.selected.prod ? $scope.selected.prod : $scope.item.prod;
                                        $scope.calculated = updateGenericPrice($scope, $scope.item.tile_data.hierarchy, $scope.classes, prod, size, top, base, $scope.selected.product_code);
                                    }
                                        editedResponse = $scope.edit($scope.item.tile_id, {
                                            qty: $scope.item.qty,
                                            itemSize: $scope.selected.size,
                                            product:  $scope.calculated.code,
                                            edit_submit : $scope.item.itemId
                                        });

                                }else if($scope.item.optionalPan) {
                                    editedResponse = $scope.edit($scope.item.tile_id, {
                                        qty: 1,
                                        favorite: false,
                                        base_product_code: ($scope.calculated.base_product_code) ? $scope.calculated.base_product_code : $scope.calculated.code,
                                        add_pan_code: $scope.selected.secondPan,
                                        add_pan: 1,
                                        edit_submit: $scope.item.itemId
                                    });
                                }else {
                                editedResponse = $scope.edit($scope.item.tile_id, {
                                    qty: $scope.item.qty,
                                    itemSize: $scope.selected.size,
                                    product:  $scope.calculated.code,
                                    edit_submit : $scope.item.itemId
                                });
                                }
                            };

                            $scope.__edit = function(){
                                var msg;
                                if($scope.selected && $scope.selected.addPan && !$scope.selected.secondPan){
                                    msg = 'Please choose a recipe for your 2nd pan.';
                                    alertSubmitOrder(msg);
                                    return;
                                }
                                $scope.selected.size = ($scope.selected.size === "default_text" && $scope.item.selects[0] && $scope.item.selects[0].options.length === 2) ? $scope.item.selects[0].options[1].val : $scope.selected.size;
                                $scope.editItems();

                            };

                            function getProductControllers () {
                                if($scope.item && $scope.item.selects){
                                var productControllers =  $scope.item.selects;
                                for (var selectsIndex = 0; selectsIndex < productControllers.length; selectsIndex++) {
                                    if(productControllers[selectsIndex].name === 'size'){
                                        var sizes = productControllers[selectsIndex].options;
                                        for(var option = 0; option < sizes.length; option++){
                                            if(sizes[option].selected){
                                                $scope.item.size = sizes[option].val;
                                                break;
                                            }
                                        }
                                    } else if(productControllers[selectsIndex].name === 'base'){
                                        var bases = productControllers[selectsIndex].options;
                                        for(var optn = 0; optn < bases.length; optn++){
                                            if(bases[optn].selected){
                                                $scope.item.base = bases[optn].val;
                                                break;
                                            }
                                        }
                                    } else if(productControllers[selectsIndex].name === 'topp'){
                                        var topps = productControllers[selectsIndex].options;
                                        for(var top = 0; top < topps.length; top++){
                                            if(topps[top].selected){
                                                $scope.item.topp = topps[top].val;
                                                break;
                                            }
                                        }
                                    }else if(productControllers[selectsIndex].name === 'prod') {
                                        var prods = productControllers[selectsIndex].options;
                                        for (var prod = 0; prod < prods.length; prod++) {
                                            if (prods[prod].selected) {
                                                $scope.item.prod = prods[prod].val;
                                                break;
                                            }
                                        }
                                    }
                                }
                                }

                            }

                            function routeToSummary () {
                                var route;
                                route = 'index.order';
                                if ($state && route) {
                                    $state.go(route);
                                }
                            }
                            $scope.edit = function (tileId, params) {
                                var editPromise = $q.defer();
                                if($scope.position){
                                    params.position = $scope.position;
                                }
                                MenuService.submitTile(tileId, params,'edited')
                                    .then(function (res) {
                                        var user = AccountService.get();
                                        // -- begin SF Streaming Updates and Track Cart when Edit cart items
                                        _etmc.push(["setOrgId", CONFIG.COLLECT.MID]);
                                        if(!user.isGuest) { // -send user details if registered
                                            _etmc.push(["setUserInfo", {"email": user.email}]);
                                        }
                                        _etmc.push(["updateItem", res.response.predictive.updateItem]);
                                        _etmc.push(["trackCart", {"cart" :res.response.predictive.trackCart.cart}]);
                                        _etmc.push(["trackPageView"]);
                                        // --end SF calls
                                        editPromise.resolve({});
                                        routeToSummary();
                                    }, function (err) {
                                        $log.error("MenuPageCtrl add:", err);
                                        editPromise.reject({});
                                    });
                                return editPromise.promise;
                            };

                            $scope.__cancel = function(){
                                routeToSummary();
                            };
                            $scope.__add = function () {
                                var addedResponse;
                                var tile_position;
                                if($scope.item && $scope.item.tile_id){
                                    if ($scope.item.analytics && $scope.item.analytics.position) {
                                        tile_position = $scope.item.analytics.position;
                                    }
                                    $window.sessionStorage.tileID = $scope.item.tile_id;
                                }
                                OrderService.data.notVisitOrderPages = true;
                                if (($scope.page === 'pizza' || $scope.page === 'allupsell') && $scope.item['class'] === 'P') {
                                    // way too much duplication of added response handling in this method.
                                    var unavailable_toppings = [];
                                    var pizzaDef = {
                                        qty: 1,
                                        favorite: false,
                                        'size': $scope.selected.size,
                                        'crust': $scope.selected.crust,
                                        'class': $scope.item['class'],
                                        'subclass': $scope.item.subclss,
                                        'combos': $scope.item.prod,
                                        'cannot_configure':$scope.item.cannot_configure //added for gluten free to make pizza whether editable or not

                                    };
                                    if($scope.position){
                                        pizzaDef.position = $scope.position;
                                    }                                    

                                    if ($scope.item.topp) {
                                        pizzaDef['topps[' + $scope.item.topp + '][0]'] = 1;
                                        pizzaDef['topps[' + $scope.item.topp + '][1]'] = 1;
                                        pizzaDef.combos = 'B';
                                    }

                                    if($scope.item.tile_data.oop_topping_msg){

                                        unavailable_toppings = $scope.item.tile_data.unavailable_toppings;
                                        pizzaDef.unavailable_toppings = unavailable_toppings.join(',');

                                        var modalScope = {};
                                        // modalScope.title = "";
                                        modalScope.message = $scope.item.tile_data.oop_topping_msg;
                                        modalScope.fontSize = "10px!important";
                                        modalScope.button = {
                                            reject: "CHOOSE A DIFFERENT RECIPE",
                                            confirm: "MAKE IT ANYWAY"
                                        };
                                        var modal = ModalService.open(undefined, CONFIG.MENU.MODAL.OOS, modalScope, 'md')
                                            .result.then(function () {
                                                if ($scope.skinny === true){
                                                    PbModalService.open('US2241').then(function (confirm) {
                                                        addedResponse = $scope.add($scope.item.tile_id, pizzaDef);
                                                        handleAddPromise(addedResponse);
                                                    }, function (reject) {
                                                    });
                                                }else if ($scope.gluten === true) {
                                                    PbModalService.open('PH6100').then(function (confirm) {
                                                        addedResponse = $scope.add($scope.item.tile_id, pizzaDef);
                                                        handleAddPromise(addedResponse);
                                                    }, function (reject) {
                                                    });
                                                }else{
                                                    addedResponse = $scope.add($scope.item.tile_id, pizzaDef);
                                                    handleAddPromise(addedResponse);
                                                }
                                            }, function () {});
                                    } else {
                                        if ($scope.skinny === true) {
                                            PbModalService.open('US2241').then(function (confirm) {
                                                addedResponse = $scope.add($scope.item.tile_id, pizzaDef);
                                                handleAddPromise(addedResponse);
                                            }, function (reject) {
                                            });
                                        } else if ($scope.gluten === true) {
                                            PbModalService.open('PH6100').then(function (confirm) {
                                                addedResponse = $scope.add($scope.item.tile_id, pizzaDef);
                                                handleAddPromise(addedResponse);
                                            }, function (reject) {
                                            });
                                        } else {
                                            addedResponse = $scope.add($scope.item.tile_id, pizzaDef);
                                            handleAddPromise(addedResponse);
                                        }
                                    }

                                } else {
                                    //product clicks should fire on deal tiles, but not master tiles
                                    //not sure why button copy is used as a condition, but left alone to reduce change risk...
                                    if($scope.item && ($scope.item.button_copy ===  "Get Started" || $scope.item.type === "2") && !$scope.item.isMasterCoupon){
                                        if($scope.item && $scope.item.analytics){
//                                            var tile_position = MenuService.getImpPosition($scope.item.analytics.id);
                                            if(typeof $scope.item.analytics.list == 'undefined'){
                                                $scope.item.analytics.list = $rootScope.last_list;
                                            }
                                            product_click_dataLayer = {
                                                'event': 'productClick',
                                                'ecommerce': {
                                                    'click': {
                                                        'actionField': {'list': $scope.item.analytics.list},
                                                        'products': PhUtils.GCCommonObjects($scope.item.analytics.name,$scope.item.analytics.id,$scope.item.analytics.price,$scope.item.analytics.category,$scope.item.analytics.variant,"",undefined,tile_position)
                                                    }
                                                }
                                            };
                                            window.tileClicked = false;
                                            $window.dataLayer.push(product_click_dataLayer);
                                            product_click_dataLayer = {};
                                        }
                                    } else if($scope.auto && $scope.auto.analytics){
                                            if(typeof $scope.auto.analytics.list == 'undefined'){
                                                $scope.auto.analytics.list = $rootScope.last_list;
                                            }
                                            product_click_dataLayer = {
                                                'event': 'productClick',
                                                'ecommerce': {
                                                    'click': {
                                                        'actionField': {'list': $scope.auto.analytics.list},
                                                        'products': PhUtils.GCCommonObjects($scope.auto.analytics.name,$scope.auto.analytics.id,$scope.auto.analytics.price,$scope.auto.analytics.category,$scope.auto.analytics.variant,"")
                                                    }
                                                }
                                            };
                                            $window.dataLayer.push(product_click_dataLayer);
                                            product_click_dataLayer = {};                                        
                                    } else if ($scope.item && ($scope.item.isMasterCoupon || $scope.item.type === "1")) {
                                    //fire promo clicks if this is a master coupon tile.
                                        var promotionsArr = [], promo_click_dataLayer = {};
                                        var id = '', name = '', creative = '', position = 1;
                                        creative = $scope.item.analytics.creative;
                                        if($scope.item.analytics.name){
                                            name = $scope.item.analytics.name;
                                        }
                                        if($scope.item.analytics.id){
                                            id = $scope.item.analytics.id;
                                        }
                                        if($scope.item.display_order){
                                            position = parseInt($scope.item.display_order) + 1;
                                        }
                                        promotionsArr.push(PhUtils.GAPromo(id, name, creative, position));

                                            promo_click_dataLayer = {
                                            'event':'promotionClick',
                                            'ecommerce': {
                                                'promoClick': {
                                                    'promotions': promotionsArr
                                                }
                                            }
                                        };
                                        $window.dataLayer.push(promo_click_dataLayer);
                                        promo_click_dataLayer = {};                                        
                                    }

                                    if (($scope.auto && $scope.auto.deal_code.length) || ($scope.item && $scope.item.deal_code && $scope.item.deal_code.length)) {
                                        // reconcile auto and item discrepency
                                        var item = $scope.auto || $scope.item;
                                        //VCO start
                                         if($scope.item && $scope.item.deal_code && $scope.item.deal_code === 'VISACHECKOUTDEAL'){
                                             if($scope.item && $scope.item.mobile_link){
                                                 window.location.href = $scope.item.mobile_link;
                                             }
                                         } //VCO end
                                         else{
                                             addedResponse = $scope.add(item.tile_id, {
                                                 is_deal: true,
                                                 item: item
                                             });
                                             handleAddPromise(addedResponse);
                                         }


                                    } else if ($scope.page == 'deals' && $scope.auto && $scope.auto.tile_id && $scope.auto.price) {
                                        addedResponse = $scope.add($scope.auto.tile_id, {
                                            qty: 1,
                                            favorite: false,
                                            product: $scope.auto.price
                                        });
                                        handleAddPromise(addedResponse);
                                    } else if ($scope.calculated && $scope.calculated.code) {
                                        //PH-8855 this covers multi-product tiles (ie: don't skip the dip)
                                        if ($scope.item.multi_class) {
                                            addedResponse = $scope.add($scope.item.tile_id, {
                                                qty: 1,
                                                favorite: false,
                                                product: $scope.calculated.code,
                                                tile_class: 'multi-product',
                                                position: $scope.position || ''
                                            });
                                        } else if ($scope.item.optionalPan) {
                                            if ($scope.selected.addPan && !$scope.selected.secondPan) {
                                                msg = "Please choose a recipe for your 2nd pan.";
                                                alertSubmitOrder(msg);
                                            } else {
                                                addedResponse = $scope.add($scope.item.tile_id, {
                                                    qty: 1,
                                                    favorite: false,
                                                    base_product_code: ($scope.calculated.base_product_code) ? $scope.calculated.base_product_code : $scope.calculated.code,
                                                    add_pan_code: $scope.selected.secondPan,
                                                    add_pan: 1,
                                                    edit_submit: '',
                                                    position: $scope.position || ''
                                                });
                                            }

                                        } else {
                                            addedResponse = $scope.add($scope.item.tile_id, {
                                                qty: 1,
                                                favorite: false,
                                                product: $scope.calculated.code,
                                                position: tile_position || ''
                                            });
                                        }

                                        handleAddPromise(addedResponse);
                                        // this values to be made to default once user clicks the product to add to order then we have to make it to default. 
                                        if ($scope.item && $scope.item.selects &&  $scope.item.selects.length === 2) {
                                            $scope.selected.prod = 'default_text';
                                            $scope.selected.size = 'default_text';
                                        }
                                        $scope.__update('init');

                                    } else if (angular.isArray($scope.item.hidden)) {
                                        var paramsObj = {};
                                        if($scope.position){
                                            paramsObj.position = $scope.position;
                                        }

                                        $scope.selected.size = ($scope.selected.size === "default_text" && $scope.item.selects[0].options.length === 2) ? $scope.item.selects[0].options[1].val : $scope.selected.size;

                                        for (var i = 0; i < $scope.item.hidden.length; i++) {
                                            paramsObj[$scope.item.hidden[i].name] = $scope.item.hidden[i].value;
                                        }

                                        if (angular.isArray($scope.item.selects)) {
                                            for (var j = 0; j < $scope.item.selects.length; j++) {
                                                paramsObj[$scope.item.selects[j].name] = $scope.selected[$scope.item.selects[j].name];
                                            }
                                        }

                                        if(paramsObj.prod && paramsObj.size ){
                                            var msg;
                                            if((paramsObj.prod === 'default_text' || paramsObj.size === 'default_text') && $scope.item.selects[0].options[($scope.item.selects[0].options.length)-1].hasOwnProperty('selected') ){
                                                if($scope.item.selects[0].options[($scope.item.selects[0].options.length)-1].selected && paramsObj.prod === 'default_text'){
                                                    msg = "What sauce flavor would you like to order?";
                                                    alertSubmitOrder(msg);
                                                }else{
                                                    addedResponse = $scope.add($scope.item.tile_id, paramsObj);
                                                    handleAddPromise(addedResponse);
                                                }
                                            }else if(paramsObj.prod === 'default_text' || paramsObj.size === 'default_text'){
                                                if(paramsObj.prod === 'default_text' && paramsObj.size !== 'default_text'){
                                                    msg = "What sauce flavor would you like to order?";
                                                }else if(paramsObj.prod !== 'default_text' && paramsObj.size === 'default_text'){
                                                    msg = "How many pieces would you like to order?";
                                                }
                                                else{
                                                    msg = "Choose a sauce flavor and the number of pieces you want to order.";
                                                }
                                                alertSubmitOrder(msg);
                                            }else if(paramsObj.prod !== 'default_text' && paramsObj.size !== 'default_text' ){
                                                addedResponse = $scope.add($scope.item.tile_id, paramsObj);
                                                handleAddPromise(addedResponse);
                                            }

                                        }else{
                                            var mobile_link = $scope.item.mobile_link;
                                            if($rootScope.isApp){
                                                if( mobile_link && mobile_link.indexOf('#') >= 0 && mobile_link.indexOf('menu') >= 0){
                                                    var mobileLink = mobile_link.split('/');
                                                    if(mobileLink[2] === "menu"){
                                                        $state.go('index.menu.page', {
                                                            page: mobileLink[3]
                                                        });
                                                    }else{
                                                        window.location.href = mobile_link;
                                                    }

                                                }else{
                                                    addedResponse = $scope.add($scope.item.tile_id, paramsObj);
                                                    handleAddPromise(addedResponse);
                                                }

                                            }else{
                                                if( mobile_link && mobile_link.indexOf('#') >= 0 && mobile_link.indexOf('menu') >= 0){
                                                    window.location.href = mobile_link;
                                                }else if(mobile_link){
                                                    window.location.href = mobile_link;
                                                }else{
                                                    addedResponse = $scope.add($scope.item.tile_id, paramsObj);
                                                    handleAddPromise(addedResponse);
                                                }
                                            }


                                        }


                                    }else{
                                        // completely uncaught case that does absolutely nothing in case all the assumptions have failed.
                                    }

                                    if($scope.item !== undefined && $scope.item.source === 'upsell'){
                                        addedResponse.then(function(){
                                            $scope.topp = [0];
                                            $scope.$watch($scope.item, function() {
                                                $scope.__update('init');
                                                if($scope.selected.prod !== 'default_text' && ($scope.selected.size !== 'default_text' || $scope.item.selects[0].options.length === 2)){
                                                    $scope.calculated = updateGenericPrice($scope, $scope.item.tile_data.hierarchy, $scope.classes,
                                                        $scope.selected.prod, $scope.selected.size, $scope.topp[0], $scope.selected.base, $scope.selected.product_code);
                                                }

                                                displayShortDescription($scope.item.description, $scope.item.title, $scope);
                                            });
                                        });
                                    }
                                }
                            };

                            function getVariant(crusts , sizes, selectedCrust, selectedSize){
                                var variantCrust, variantSize;
                                for (var i = 0; i < crusts.length; i++){
                                    if(crusts[i].val === selectedCrust){
                                        variantCrust =  crusts[i].text;
                                    }
                                }

                                for (var j = 0; j < sizes.length; j++){
                                    if(sizes[j].val === selectedSize){
                                        variantSize =  sizes[j].text;
                                    }
                                }

                                return (variantCrust + ','+ variantSize);
                            }

                            $scope.__getStarted = function (selected, selectedItem, calculatedPrice) {
                                //$scope.add(selected);
                                //TODO: Temp Route To Pizza Builder
                                if(calculatedPrice){
                                    variant = getVariant(selected.crusts, selected.sizes ,selectedItem.crust, selectedItem.size);
                                    if(typeof selected.analytics.list == 'undefined'){
                                        selected.analytics.list = $rootScope.last_list;
                                    }
                                    product_click_dataLayer = {
                                        'event': 'productClick',
                                        'ecommerce': {
                                            'click': {
                                                'actionField': {'list': selected.analytics.list},
                                                'products': PhUtils.GCCommonObjects(selected.analytics.name,selected.analytics.id,calculatedPrice.price,selected.analytics.category,variant,"")
                                            }
                                        }
                                    };
                                    $window.dataLayer.push(product_click_dataLayer);
                                    product_click_dataLayer = {};
                                }

                                $state.go('index.pizzabuilder');
                            };
                            $scope.__pizzaBuilder = function (selected, selectedItem, calculatedPrice) {
                                //$scope.add(selected);
                                var tile_position = MenuService.getImpPosition(selected.analytics.id);
                                if (typeof tile_position === 'undefined') {
                                    tile_position = selected.analytics.position;
                                }
                                PizzaBuilderService.setCyoPosition(tile_position);
                                //TODO: Temp Route To Pizza Builder
                                if(calculatedPrice){
                                    variant = "";
                                    if(typeof selected.analytics.list == 'undefined'){
                                        selected.analytics.list = $rootScope.last_list;
                                    }
                                    product_click_dataLayer = {
                                        'event': 'productClick',
                                        'ecommerce': {
                                            'click': {
                                                'actionField': {'list': selected.analytics.list},
                                                'products': PhUtils.GCCommonObjects(selected.analytics.name,selected.analytics.id,calculatedPrice.price,selected.analytics.category,variant,"",undefined,tile_position)
                                            }
                                        }
                                    };
                                    $rootScope.last_pizza_click = product_click_dataLayer;
                                    $window.dataLayer.push(product_click_dataLayer);
                                    product_click_dataLayer = {};
                                }
                                var combo_code = (selected.prod !== null) ? selected.prod : 'B';
                                if(selected.tile_data.oop_topping_msg){
                                    var modalScope = {};
                                    modalScope.message = selected.tile_data.oop_topping_msg;
                                    modalScope.fontSize = "10px!important";
                                    modalScope.button = {
                                        reject: "CHOOSE A DIFFERENT RECIPE",
                                        confirm: "MAKE IT ANYWAY"
                                    };
                                    var modal = ModalService.open(undefined, CONFIG.MENU.MODAL.OOS, modalScope, 'md')
                                        .result.then(function (confirm) {
                                            $state.go('index.pizzabuilder', {
                                                co: combo_code,
                                                c: $scope.selected.crust,
                                                s: $scope.selected.size,
                                                // TODO: Support for single topping Pizza
                                                // If multiple topps will need to change to an array
                                                t: (selected.prod !== null) ? undefined : [selected.topp]
                                            });
                                        }, function (reject) {});

                                }else{
                                    $state.go('index.pizzabuilder', {
                                        co: combo_code,
                                        c: $scope.selected.crust,
                                        s: $scope.selected.size,
                                        // TODO: Support for single topping Pizza
                                        // If multiple topps will need to change to an array
                                        t: (selected.prod !== null) ? undefined : [selected.topp]
                                    });
                                }
                            };

                            $scope.showFullDescription = function (id) {
                                //On Safari, the popover won't hide even when it's not focus. Have to hide the previous popover when openning a new one. 
                                if (angular.element('.moreDescription')) {
                                    angular.element('.moreDescription').hide();
                                }

                                var options = {
                                    trigger: 'manual',
                                    title: '',
                                    placement: 'auto',
                                    template: 'scripts/components/menu/menu-more-description.tpl.html'
                                };
                                if ($scope.isEditItem) {
                                    angular.element('.ph-tile').filter(":hidden").remove();
                                }

                                //if the position of "more" is too close to the border, there is a chance the popup won't show up in the app. Adjust the placement of the popover if it's close to the border. 
                                var tile_width = angular.element('.ph-tile').width();
                                if ($scope.item) {
                                    if ($scope.item.tile_id) {
                                        var btn_x_position = angular.element('#' + $scope.item.tile_id).position().left;

                                        if (tile_width - btn_x_position < 100) {
                                            options.placement = 'left';
                                        }
                                        if (tile_width - btn_x_position > 250) {
                                            options.placement = 'right';
                                        }
                                    }
                                }
                                if ($scope.auto) {
                                    if ($scope.auto.tile_id) {
                                        var btn_x_position_auto = angular.element('#' + $scope.auto.tile_id).position().left;

                                        if (tile_width - btn_x_position_auto < 100) {
                                            options.placement = 'left';
                                        }
                                        if (tile_width - btn_x_position_auto > 250) {
                                            options.placement = 'right';
                                        }
                                    }
                                }

                                $scope.popover = $scope.popover || $popover(angular.element("#" + id), options);

                                if ($scope.auto) {
                                    if ($scope.auto.description.length > 3) {
                                        $scope.popover.$scope.description = $scope.auto.description;
                                    } else {
                                        $scope.popover.$scope.description = $scope.auto.deal_items_desc;
                                    }
                                } else {
                                    $scope.popover.$scope.description = $scope.item.description;
                                }
                                $scope.popover.$promise.then(function () {
                                    $scope.popover.show();
                                    if (ResponsiveUtility.viewport.isXSmall()) {
                                        $timeout(positionPopover, 100);
                                    }

                                    //PH-8157 - Code below is customized for WingStreet Lead Market only
                                    // we change the URL in the popover from pizzhut.com/sauces to pizzahut.com/sauceslead
                                    //this will send the user to the new page with 16 sauces
                                    if($scope.item && $scope.item.selects>0) {
                                        var isLM = $scope.item.selects[1].options.length;
                                        if ($scope.item && $scope.item.class === "WS" && isLM >= 12) {
                                            setTimeout(function () {
                                                var popLink = document.getElementsByClassName("popover-content description");
                                                for (var n in popLink) {
                                                    if (popLink[n].innerHTML && popLink[n].innerHTML.indexOf('href="/sauces"')) {
                                                        popLink[n].innerHTML = popLink[n].innerHTML.replace('href="/sauces"', 'href="/sauceslead"');
                                                    }
                                                }
                                            }, 500);
                                        }
                                    }
                                });

                                //for mobile, if it's too close to the left edge, move it a little bit
                                function positionPopover() {
                                    if (angular.element('.moreDescription')) {
                                        var pop_left = angular.element('.moreDescription').position().left;
                                        var tile_left = angular.element('.ph-tile').position().left;

                                        if (tile_left > pop_left) {
                                            angular.element('.moreDescription').css({
                                                left: tile_left
                                            });
                                        }
                                    }
                                }
                            };
                        }
                    ]
                };
            }
        ]);
}(angular));