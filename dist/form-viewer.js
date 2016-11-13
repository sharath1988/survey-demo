angular.module('mwFormViewer', ['ngSanitize', 'ui.bootstrap','ng-sortable', 'pascalprecht.translate']);




angular.module('mwFormViewer')
    .directive('mwPriorityList', function () {

    return {
        replace: true,
        restrict: 'AE',
        require: '^mwFormQuestion',
        scope: {
            question: '=',
            questionResponse: '=',
            readOnly: '=?',
            options: '=?'
        },
        templateUrl: 'mw-priority-list.html',
        controllerAs: 'ctrl',
        bindToController: true,
        controller: function(){
            var ctrl = this;

            if(!ctrl.questionResponse.priorityList){
                ctrl.questionResponse.priorityList=[];
            }
            ctrl.idToItem = {};


            sortByPriority(ctrl.questionResponse.priorityList);

            ctrl.availableItems=[];
            ctrl.question.priorityList.forEach(function(item){
                ctrl.idToItem[item.id] = item;
                var ordered = ctrl.questionResponse.priorityList.some(function(ordered){
                    return item.id == ordered.id;
                });
                if(!ordered){
                    ctrl.availableItems.push({
                        priority: null,
                        id: item.id
                    });
                }
            });

            ctrl.allItemsOrdered=ctrl.availableItems.length==0 ? true : null;


            function updatePriority(array) {
                if(array){
                    for(var i=0; i<array.length; i++){
                        var item = array[i];
                        item.priority = i+1;
                    }
                }

            }

            function sortByPriority(array) {
                array.sort(function (a, b) {
                    return a.priority - b.priority;
                });
            }

            var baseConfig = {
                disabled: ctrl.readOnly,
                ghostClass: "beingDragged"
//                tolerance: 'pointer',
//                items: 'div',
//                revert: 100

            };

            ctrl.orderedConfig = angular.extend({}, baseConfig, {
                group:{
                    name: 'A',
                    pull: false,
                    put: ['B']
                },
                onEnd: function(e, ui) {
                    updatePriority(ctrl.questionResponse.priorityList);
                }
            });

            ctrl.availableConfig = angular.extend({}, baseConfig, {
                sort:false,
                 group:{
                    name: 'B',
                    pull: ['A'],
                    put: false
                },
                onEnd: function(e, ui) {
                    updatePriority(ctrl.questionResponse.priorityList);
                    ctrl.allItemsOrdered=ctrl.availableItems.length==0 ? true : null;
                }
            });

        },
        link: function (scope, ele, attrs, mwFormQuestion){
            var ctrl = scope.ctrl;
            ctrl.print =  mwFormQuestion.print;
        }
    };
});


angular.module('mwFormViewer').directive('mwFormViewer', function () {

    return {
        replace: true,
        restrict: 'AE',
        scope: {
            formData: '=',
            responseData: '=',
            templateData: '=?',
            readOnly: '=?',
            options: '=?',
            formStatus: '=?', //wrapper for internal angular form object
            onSubmit: '&',
            api: '=?'

        },
        templateUrl: 'mw-form-viewer.html',
        controllerAs: 'ctrl',
        bindToController: true,
        controller: ["$timeout", "$interpolate", function($timeout, $interpolate){
            var ctrl = this;

            ctrl.defaultOptions = {
                nestedForm: false,
                autoStart: false,
                disableSubmit: false
            };
            ctrl.options = angular.extend({}, ctrl.defaultOptions, ctrl.options);

            ctrl.submitStatus='NOT_SUBMITTED';
            ctrl.formSubmitted=false;

            sortPagesByNumber();
            ctrl.pageIdToPage={};
            ctrl.formData.pages.forEach(function(page){
                ctrl.pageIdToPage[page.id]=page;
            });


            ctrl.buttons={
                prevPage: {
                    visible: false,
                    disabled: false
                },
                nextPage: {
                    visible: false,
                    disabled: false
                },
                submitForm: {
                    visible: false,
                    disabled: false
                }
            };

            ctrl.submitForm = function(){
                ctrl.formSubmitted=true;
                ctrl.submitStatus='IN_PROGRESS';

                ctrl.setCurrentPage(null);


                var resultPromise = ctrl.onSubmit();
                resultPromise.then(function(){
                    ctrl.submitStatus='SUCCESS';
                }).catch(function(){
                    ctrl.submitStatus='ERROR';
                });


            };

            ctrl.setCurrentPage = function (page) {
                ctrl.currentPage = page;
                if(!page){

                    ctrl.buttons.submitForm.visible=false;
                    ctrl.buttons.prevPage.visible=false;

                    ctrl.buttons.nextPage.visible=false;
                    return;
                }

                ctrl.setDefaultNextPage();

                ctrl.initResponsesForCurrentPage();


            };


            ctrl.setDefaultNextPage  = function(){
                var index = ctrl.formData.pages.indexOf(ctrl.currentPage);
                ctrl.currentPage.isFirst = index==0;
                ctrl.currentPage.isLast = index==ctrl.formData.pages.length-1;

                ctrl.buttons.submitForm.visible=ctrl.currentPage.isLast;
                ctrl.buttons.prevPage.visible=!ctrl.currentPage.isFirst;

                ctrl.buttons.nextPage.visible=!ctrl.currentPage.isLast;
                if(ctrl.currentPage.isLast){
                    ctrl.nextPage=null;
                }else{
                    ctrl.nextPage=ctrl.formData.pages[index+1];
                }

                if(ctrl.currentPage.pageFlow){
                    var formSubmit = false;
                    if(ctrl.currentPage.pageFlow.formSubmit){
                        ctrl.nextPage=null;
                        formSubmit = true;
                    }else if(ctrl.currentPage.pageFlow.page){
                        ctrl.nextPage=ctrl.pageIdToPage[ctrl.currentPage.pageFlow.page.id];
                        ctrl.buttons.nextPage.visible=true;
                    }else if(ctrl.currentPage.isLast){
                        ctrl.nextPage=null;
                        formSubmit = true;
                    }
                    ctrl.buttons.submitForm.visible=formSubmit;
                    ctrl.buttons.nextPage.visible=!formSubmit;
                }
            };

            ctrl.initResponsesForCurrentPage = function(){
                ctrl.currentPage.elements.forEach(function(element){
                    var question = element.question;
                    if(question && !ctrl.responseData[question.id]){
                        ctrl.responseData[question.id]={};
                    }
                });
            };

            ctrl.beginResponse=function(){

                if(ctrl.formData.pages.length>0){
                    ctrl.setCurrentPage(ctrl.formData.pages[0]);
                }
            };

            ctrl.resetPages = function(){
                ctrl.prevPages=[];

                ctrl.currentPage=null;
                ctrl.nextPage = null;
                ctrl.formSubmitted=false;
                if(ctrl.options.autoStart){
                    ctrl.beginResponse();
                }

            };
            ctrl.resetPages();

            ctrl.goToPrevPage= function(){
                var prevPage = ctrl.prevPages.pop();
                ctrl.setCurrentPage(prevPage);
                ctrl.updateNextPageBasedOnAllAnswers();
            };

            ctrl.goToNextPage= function(){
                ctrl.prevPages.push(ctrl.currentPage);

                ctrl.updateNextPageBasedOnAllAnswers();

                ctrl.setCurrentPage(ctrl.nextPage);
            };

            ctrl.updateNextPageBasedOnAllAnswers = function(){
                ctrl.currentPage.elements.forEach(function(element){
                    ctrl.updateNextPageBasedOnPageElementAnswers(element);
                });

                ctrl.buttons.submitForm.visible=!ctrl.nextPage;
                ctrl.buttons.nextPage.visible=!!ctrl.nextPage;
            };

            ctrl.updateNextPageBasedOnPageElementAnswers = function (element) {
                var question = element.question;
                if (question && question.pageFlowModifier) {
                    question.offeredAnswers.forEach(function (answer) {
                        if (answer.pageFlow) {
                            if(ctrl.responseData[question.id].selectedAnswer == answer.id){
                                if (answer.pageFlow.formSubmit) {
                                    ctrl.nextPage = null;
                                } else if (answer.pageFlow.page) {
                                    ctrl.nextPage = ctrl.pageIdToPage[answer.pageFlow.page.id];
                                }
                            }
                        }
                    });
                }
            };

            ctrl.onResponseChanged = function(pageElement){
                ctrl.setDefaultNextPage();
                ctrl.updateNextPageBasedOnAllAnswers();
            };

            if(ctrl.api){
                ctrl.api.reset = function(){
                    for (var prop in ctrl.responseData) {
                        if (ctrl.responseData.hasOwnProperty(prop)) {
                            delete ctrl.responseData[prop];
                        }
                    }

                    ctrl.buttons.submitForm.visible=false;
                    ctrl.buttons.prevPage.visible=false;
                    ctrl.buttons.nextPage.visible=false;
                    ctrl.currentPage=null;
                    $timeout(ctrl.resetPages, 0);

                }
            }

            function sortPagesByNumber() {
                ctrl.formData.pages.sort(function(a,b){
                    return a.number - b.number;
                });
            }

            ctrl.print=function(input){
                if (ctrl.templateData){
                    return $interpolate(input)(ctrl.templateData);
                }
                return input;
            }

        }],
        link: function (scope, ele, attrs){
            var ctrl = scope.ctrl;
            if(ctrl.formStatus){
                ctrl.formStatus.form = ctrl.form;
            }


        }
    };
});


angular.module('mwFormViewer').factory("FormQuestionId", function(){
    var id = 0;
        return {
            next: function(){
                return ++id;
            }
        }
    })

    .directive('mwFormQuestion', function () {

    return {
        replace: true,
        restrict: 'AE',
        require: '^mwFormViewer',
        scope: {
            question: '=',
            questionResponse: '=',
            readOnly: '=?',
            options: '=?',
            onResponseChanged: '&?'
        },
        templateUrl: 'mw-form-question.html',
        controllerAs: 'ctrl',
        bindToController: true,
        controller: ["$timeout", "FormQuestionId", function($timeout,FormQuestionId){
            var ctrl = this;
            ctrl.id = FormQuestionId.next();

            if(ctrl.question.type=='radio'){
                if(!ctrl.questionResponse.selectedAnswer){
                    ctrl.questionResponse.selectedAnswer=null;
                }
                if(ctrl.questionResponse.other){
                    ctrl.isOtherAnswer=true;
                }

            }else if(ctrl.question.type=='checkbox'){
                if(ctrl.questionResponse.selectedAnswers && ctrl.questionResponse.selectedAnswers.length){
                    ctrl.selectedAnswer=true;
                }else{
                    ctrl.questionResponse.selectedAnswers=[];
                }
                if(ctrl.questionResponse.other){
                    ctrl.isOtherAnswer=true;
                }


            }else if(ctrl.question.type=='grid'){
                if(!ctrl.question.grid.cellInputType){
                    ctrl.question.grid.cellInputType = "radio";
                }
                //if(ctrl.questionResponse.selectedAnswers){
                //
                //}else{
                //    ctrl.questionResponse.selectedAnswers={};
                //}
            }else if(ctrl.question.type=='division'){

                    ctrl.computeDivisionSum = function(){
                        ctrl.divisionSum=0;
                        ctrl.question.divisionList.forEach(function(item){

                            if(ctrl.questionResponse[item.id]!=0 && !ctrl.questionResponse[item.id]){
                                ctrl.questionResponse[item.id]=null;
                                ctrl.divisionSum+=0;
                            }else{
                                ctrl.divisionSum+=ctrl.questionResponse[item.id];
                            }
                        });
                    };

                ctrl.computeDivisionSum();


            }



            ctrl.isAnswerSelected=false;

            ctrl.selectedAnswerChanged=function(){
                delete ctrl.questionResponse.other;
                ctrl.isOtherAnswer=false;
                ctrl.answerChanged();

            };
            ctrl.otherAnswerRadioChanged= function(){
                console.log('otherAnswerRadioChanged');
                if(ctrl.isOtherAnswer){
                    ctrl.questionResponse.selectedAnswer=null;
                }
                ctrl.answerChanged();
            };

            ctrl.otherAnswerCheckboxChanged= function(){
                if(!ctrl.isOtherAnswer){
                    delete ctrl.questionResponse.other;
                }
                ctrl.selectedAnswer = ctrl.questionResponse.selectedAnswers.length||ctrl.isOtherAnswer ? true:null ;
                ctrl.answerChanged();
            };


            ctrl.toggleSelectedAnswer= function(answer){
                if (ctrl.questionResponse.selectedAnswers.indexOf(answer.id) === -1) {
                    ctrl.questionResponse.selectedAnswers.push(answer.id);
                } else {
                    ctrl.questionResponse.selectedAnswers.splice(ctrl.questionResponse.selectedAnswers.indexOf(answer.id), 1);
                }
                ctrl.selectedAnswer = ctrl.questionResponse.selectedAnswers.length||ctrl.isOtherAnswer ? true:null ;

                ctrl.answerChanged();
            };

            ctrl.answerChanged = function(){
                if(ctrl.onResponseChanged){
                    ctrl.onResponseChanged();
                }
            }

        }],
        link: function (scope, ele, attrs, mwFormViewer){
            var ctrl = scope.ctrl;
            ctrl.print =  mwFormViewer.print;
        }
    };
});


angular.module('mwFormViewer')
    .directive('mwFormConfirmationPage', function () {

    return {
        replace: true,
        restrict: 'AE',
        require: '^mwFormViewer',
        scope: {
            submitStatus: '=',
            confirmationMessage: '=',
            readOnly: '=?'
        },
        templateUrl: 'mw-form-confirmation-page.html',
        controllerAs: 'ctrl',
        bindToController: true,
        controller: function(){
            var ctrl = this;


        },
        link: function (scope, ele, attrs, mwFormViewer){
            var ctrl = scope.ctrl;
            ctrl.print =  mwFormViewer.print;
        }
    };
});
