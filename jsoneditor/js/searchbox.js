/**
 * @license
 * Licensed under the Apache License, Version 2.0 (the "License"); you may not
 * use this file except in compliance with the License. You may obtain a copy
 * of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS, WITHOUT
 * WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied. See the
 * License for the specific language governing permissions and limitations under
 * the License.
 *
 * Copyright (c) 2011-2013 Jos de Jong, http://jsoneditoronline.org
 *
 * @author  Jos de Jong, <wjosdejong@gmail.com>
 */

// create namespace
var jsoneditor = jsoneditor || {};

/**
 * @constructor jsoneditor.SearchBox
 * Create a search box in given HTML container
 * @param {jsoneditor.JSONEditor} editor    The JSON Editor to attach to
 * @param {Element} container               HTML container element of where to
 *                                          create the search box
 */
jsoneditor.SearchBox = function(editor, container) {
    var searchBox = this;

    this.editor = editor;
    this.timeout = undefined;
    this.delay = 200; // ms
    this.lastText = undefined;

    this.dom = {};
    this.dom.container = container;

    var table = document.createElement('table');
    this.dom.table = table;
    table.className = 'jsoneditor-search';
    container.appendChild(table);
    var tbody = document.createElement('tbody');
    this.dom.tbody = tbody;
    table.appendChild(tbody);
    var tr = document.createElement('tr');
    tbody.appendChild(tr);

    var td = document.createElement('td');
    td.className = 'jsoneditor-search';
    tr.appendChild(td);
    var results = document.createElement('div');
    this.dom.results = results;
    results.className = 'jsoneditor-search-results';
    td.appendChild(results);

    td = document.createElement('td');
    td.className = 'jsoneditor-search';
    tr.appendChild(td);
    var divInput = document.createElement('div');
    this.dom.input = divInput;
    divInput.className = 'jsoneditor-search';
    divInput.title = 'Search fields and values';
    td.appendChild(divInput);

    // table to contain the text input and search button
    var tableInput = document.createElement('table');
    tableInput.className = 'jsoneditor-search-input';
    divInput.appendChild(tableInput);
    var tbodySearch = document.createElement('tbody');
    tableInput.appendChild(tbodySearch);
    tr = document.createElement('tr');
    tbodySearch.appendChild(tr);

    var refreshSearch = document.createElement('button');
    refreshSearch.className = 'jsoneditor-search-refresh';
    td = document.createElement('td');
    td.appendChild(refreshSearch);
    tr.appendChild(td);

    var search = document.createElement('input');
    this.dom.search = search;
    search.className = 'jsoneditor-search';
    search.oninput = function (event) {
        searchBox.onDelayedSearch(event);
    };
    search.onchange = function (event) { // For IE 8
        searchBox.onSearch(event);
    };
    search.onkeydown = function (event) {
        searchBox.onKeyDown(event);
    };
    search.onkeyup = function (event) {
        searchBox.onKeyUp(event);
    };
    refreshSearch.onclick = function (event) {
        search.select();
    };

    // TODO: ESC in FF restores the last input, is a FF bug, https://bugzilla.mozilla.org/show_bug.cgi?id=598819
    td = document.createElement('td');
    td.appendChild(search);
    tr.appendChild(td);

    var searchNext = document.createElement('button');
    searchNext.title = 'Next result (Enter)';
    searchNext.className = 'jsoneditor-search-next';
    searchNext.onclick = function () {
        searchBox.next();
    };
    td = document.createElement('td');
    td.appendChild(searchNext);
    tr.appendChild(td);

    var searchPrevious = document.createElement('button');
    searchPrevious.title = 'Previous result (Shift+Enter)';
    searchPrevious.className = 'jsoneditor-search-previous';
    searchPrevious.onclick = function () {
        searchBox.previous();
    };
    td = document.createElement('td');
    td.appendChild(searchPrevious);
    tr.appendChild(td);

};

/**
 * Go to the next search result
 */
jsoneditor.SearchBox.prototype.next = function() {
    if (this.results != undefined) {
        var index = (this.resultIndex != undefined) ? this.resultIndex + 1 : 0;
        if (index > this.results.length - 1) {
            index = 0;
        }
        this.setActiveResult(index);
    }
};

/**
 * Go to the prevous search result
 */
jsoneditor.SearchBox.prototype.previous = function() {
    if (this.results != undefined) {
        var max = this.results.length - 1;
        var index = (this.resultIndex != undefined) ? this.resultIndex - 1 : max;
        if (index < 0) {
            index = max;
        }
        this.setActiveResult(index);
    }
};

/**
 * Set new value for the current active result
 * @param {Number} index
 */
jsoneditor.SearchBox.prototype.setActiveResult = function(index) {
    // de-activate current active result
    if (this.activeResult) {
        var prevNode = this.activeResult.node;
        var prevElem = this.activeResult.elem;
        if (prevElem == 'field') {
            delete prevNode.searchFieldActive;
        }
        else {
            delete prevNode.searchValueActive;
        }
        prevNode.updateDom();
    }

    if (!this.results || !this.results[index]) {
        // out of range, set to undefined
        this.resultIndex = undefined;
        this.activeResult = undefined;
        return;
    }

    this.resultIndex = index;

    // set new node active
    var node = this.results[this.resultIndex].node;
    var elem = this.results[this.resultIndex].elem;
    if (elem == 'field') {
        node.searchFieldActive = true;
    }
    else {
        node.searchValueActive = true;
    }
    this.activeResult = this.results[this.resultIndex];
    node.updateDom();

    node.scrollTo();
};

/**
 * Set the focus to the currently active result. If there is no currently
 * active result, the next search result will get focus
 */
jsoneditor.SearchBox.prototype.focusActiveResult = function() {
    if (!this.activeResult) {
        this.next();
    }

    if (this.activeResult) {
        this.activeResult.node.focus(this.activeResult.elem);
    }
};

/**
 * Cancel any running onDelayedSearch.
 */
jsoneditor.SearchBox.prototype.clearDelay = function() {
    if (this.timeout != undefined) {
        clearTimeout(this.timeout);
        delete this.timeout;
    }
};

/**
 * Start a timer to execute a search after a short delay.
 * Used for reducing the number of searches while typing.
 * @param {Event} event
 */
jsoneditor.SearchBox.prototype.onDelayedSearch = function (event) {
    // execute the search after a short delay (reduces the number of
    // search actions while typing in the search text box)
    this.clearDelay();
    var searchBox = this;
    this.timeout = setTimeout(function (event) {
            searchBox.onSearch(event);
        },
        this.delay);
};

/**
 * Handle onSearch event
 * @param {Event} event
 * @param {boolean} [forceSearch]  If true, search will be executed again even
 *                                 when the search text is not changed.
 *                                 Default is false.
 */
jsoneditor.SearchBox.prototype.onSearch = function (event, forceSearch) {
    this.clearDelay();

    var value = this.dom.search.value;
    var text = (value.length > 0) ? value : undefined;
    if (text != this.lastText || forceSearch) {
        // only search again when changed
        this.lastText = text;
        this.results = this.editor.search(text);
        this.setActiveResult(undefined);

        // display search results
        if (text != undefined) {
            var resultCount = this.results.length;
            switch (resultCount) {
                case 0: this.dom.results.innerHTML = 'no&nbsp;results'; break;
                case 1: this.dom.results.innerHTML = '1&nbsp;result'; break;
                default: this.dom.results.innerHTML = resultCount + '&nbsp;results'; break;
            }
        }
        else {
            this.dom.results.innerHTML = '';
        }
    }
};

/**
 * Handle onKeyDown event in the input box
 * @param {Event} event
 */
jsoneditor.SearchBox.prototype.onKeyDown = function (event) {
    event = event || window.event;
    var keynum = event.which || event.keyCode;
    if (keynum == 27) { // ESC
        this.dom.search.value = '';  // clear search
        this.onSearch(event);
        jsoneditor.util.preventDefault(event);
        jsoneditor.util.stopPropagation(event);
    }
    else if (keynum == 13) { // Enter
        if (event.ctrlKey) {
            // force to search again
            this.onSearch(event, true);
        }
        else if (event.shiftKey) {
            // move to the previous search result
            this.previous();
        }
        else {
            // move to the next search result
            this.next();
        }
        jsoneditor.util.preventDefault(event);
        jsoneditor.util.stopPropagation(event);
    }
};

/**
 * Handle onKeyUp event in the input box
 * @param {Event} event
 */
jsoneditor.SearchBox.prototype.onKeyUp = function (event) {
    event = event || window.event;
    var keynum = event.which || event.keyCode;
    if (keynum != 27 && keynum != 13) { // !show and !Enter
        this.onDelayedSearch(event);   // For IE 8
    }
};
