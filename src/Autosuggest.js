'use strict';

var React = require('react');
var { PropTypes } = React;
var classnames = require('classnames');
var sectionIterator = require('./sectionIterator');
var guid = 0;

var Autosuggest = React.createClass({
  propTypes: {
    inputAttributes: PropTypes.objectOf(React.PropTypes.string), // Input's attributes (e.g. id, className)
    suggestions: PropTypes.func.isRequired,                      // Function to get the suggestions
    suggestionRenderer: PropTypes.func,                          // Function to render a single suggestion
    onChange: PropTypes.func,                                    // Called when input changes
    onSuggestionSelected: PropTypes.func,                        // Called when a suggestion was selected
    onSuggestionClick: PropTypes.func,                           // Called when a suggestion was clicked
    suggestForEmptyQuery: PropTypes.bool                         // Show suggestions when user clicks into empty field
  },
  getDefaultProps: function() {
    return {
      inputAttributes: {},
      onChange: function(){},
      onSuggestionSelected: function(){},
      onSuggestionClick: function(){}
    };
  },
  getInitialState: function() {
    guid += 1;
    this.id = guid;
    this.cache = {};

    return {
      value: this.props.inputAttributes.value || '',
      suggestions: null,
      focusedSectionIndex: null,    // Used when multiple sections are displayed
      focusedSuggestionIndex: null, // Index within a section
      valueBeforeUpDown: null       // When user interacts using the Up and Down keys,
                                    // this field remembers input's value prior to
                                    // interaction in order to revert back if ESC hit.
                                    // See: http://www.w3.org/TR/wai-aria-practices/#autocomplete
    };
  },
  resetSectionIterator: function(suggestions) {
    if (this.multipleSections) {
      sectionIterator.setData(suggestions.map(function(suggestion) {
        return suggestion.suggestions.length;
      }));
    } else {
      sectionIterator.setData(suggestions === null ? [] : suggestions.length);
    }
  },
  isMultipleSections: function(suggestions) {
    return suggestions !== null &&
      suggestions.length > 0 &&
      typeof suggestions[0] === 'object'&&
      !suggestions[0].value;
  },
  setSuggestionsState: function(suggestions) {
    this.multipleSections = this.isMultipleSections(suggestions);
    this.resetSectionIterator(suggestions);
    this.setState({
      suggestions: suggestions,
      focusedSectionIndex: null,
      focusedSuggestionIndex: null,
      valueBeforeUpDown: null
    });
  },
  suggestionsExist: function(suggestions) {
    if (this.isMultipleSections(suggestions)) {
      return suggestions.some(function(section) {
        return section.suggestions.length > 0;
      });
    }

    return suggestions.length > 0;
  },
  showSuggestions: function(input) {
    if (input.length === 0 && !this.props.suggestForEmptyQuery) {
      this.setSuggestionsState(null);
    } else if (this.cache[input]) {
      this.setSuggestionsState(this.cache[input]);
    } else {
      this.props.suggestions(input, function(error, suggestions) {
        if (error) {
          throw error;
        } else {
          if (!this.suggestionsExist(suggestions)) {
            suggestions = null;
          }

          this.cache[input] = suggestions;
          this.setSuggestionsState(suggestions);
        }
      }.bind(this));
    }
  },
  getSuggestionValue: function(suggestion){
    return suggestion.value ? suggestion.value : suggestion;
  },
  getSuggestion: function(sectionIndex, suggestionIndex) {
    return this.multipleSections
      ? this.state.suggestions[sectionIndex].suggestions[suggestionIndex]
      : this.state.suggestions[suggestionIndex];
  },
  focusOnSuggestion: function(suggestionPosition) {
    var [sectionIndex, suggestionIndex] = suggestionPosition;
    var suggestion = suggestionIndex !== null && this.getSuggestion(sectionIndex, suggestionIndex);
    var newState = {
      focusedSectionIndex: sectionIndex,
      focusedSuggestionIndex: suggestionIndex,
      value: suggestionIndex === null ? this.state.valueBeforeUpDown : this.getSuggestionValue(suggestion)
    };

    // When users starts to interact with up/down keys, remember input's value.
    if (this.state.valueBeforeUpDown === null) {
      newState.valueBeforeUpDown = this.state.value;
    }

    this.setState(newState);
    this.props.onSuggestionSelected(suggestionIndex === null ? null : suggestion);
  },
  onInputChange: function(event) {
    var newValue = event.target.value;

    this.setState({
      value: newValue,
      valueBeforeUpDown: null
    });

    this.showSuggestions(newValue);
    this.props.onChange(newValue);
  },
  onInputKeyDown: function(event) {
    var newState, newSectionIndex, newSuggestionIndex;

    switch (event.keyCode) {
      case 13: // enter
        this.setState({
          suggestions: null,
          focusedSectionIndex: null,
          focusedSuggestionIndex: null,
          valueBeforeUpDown: null
        });

        break;

      case 27: // escape
        newState = {
          suggestions: null,
          focusedSectionIndex: null,
          focusedSuggestionIndex: null,
          valueBeforeUpDown: null
        };

        if (this.state.valueBeforeUpDown !== null) {
          newState.value = this.state.valueBeforeUpDown;
        } else if (this.state.suggestions === null) {
          newState.value = '';
        }

        this.setState(newState);

        break;

      case 38: // up
        if (this.state.suggestions === null) {
          this.showSuggestions(this.state.value);
        } else {
          this.focusOnSuggestion(sectionIterator.prev([this.state.focusedSectionIndex, this.state.focusedSuggestionIndex]));
        }

        event.preventDefault(); // Prevent the cursor from jumping to input's start

        break;

      case 40: // down
        if (this.state.suggestions === null) {
          this.showSuggestions(this.state.value);
        } else {
          this.focusOnSuggestion(sectionIterator.next([this.state.focusedSectionIndex, this.state.focusedSuggestionIndex]));
        }

        break;
    }
  },
  onInputFocus: function(event){
    var newValue = event.target.value;

    this.setState({
      value: newValue,
      valueBeforeUpDown: null
    });

    this.showSuggestions(newValue);
  },
  onInputBlur: function() {
    this.setState({
      suggestions: null,
      focusedSectionIndex: null,
      focusedSuggestionIndex: null,
      valueBeforeUpDown: null
    });
  },
  onSuggestionMouseEnter: function(sectionIndex, suggestionIndex) {
    this.setState({
      focusedSectionIndex: sectionIndex,
      focusedSuggestionIndex: suggestionIndex
    });
  },
  onSuggestionMouseLeave: function() {
    this.setState({
      focusedSectionIndex: null,
      focusedSuggestionIndex: null
    });
  },
  onSuggestionMouseDown: function(suggestion) {
    this.setState({
      value: this.getSuggestionValue(suggestion),
      suggestions: null,
      focusedSectionIndex: null,
      focusedSuggestionIndex: null,
      valueBeforeUpDown: null
    }, function() {
      // This code executes after the component is re-rendered
      setTimeout(function() {
        React.findDOMNode(this.refs.input).focus();
      }.bind(this));
    });
    this.props.onSuggestionSelected(suggestion);
    this.props.onSuggestionClick(suggestion);
  },
  getSuggestionId: function(sectionIndex, suggestionIndex) {
    if (suggestionIndex === null) {
      return null;
    }

    return 'react-autosuggest-' + this.id + '-suggestion-' +
           (sectionIndex === null ? '' : sectionIndex) + '-' + suggestionIndex;
  },
  renderSuggestionsList: function(suggestions, sectionIndex) {
    return suggestions.map(function(suggestion, suggestionIndex) {
      var classes = classnames({
        'react-autosuggest__suggestion': true,
        'react-autosuggest__suggestion--focused':
          sectionIndex === this.state.focusedSectionIndex &&
          suggestionIndex === this.state.focusedSuggestionIndex
      });

      var suggestionContent = this.props.suggestionRenderer
        ? this.props.suggestionRenderer(suggestion, this.state.valueBeforeUpDown || this.state.value)
        : suggestion;

      return (
        <div id={this.getSuggestionId(sectionIndex, suggestionIndex)}
             className={classes}
             role="option"
             key={'suggestion-' + (suggestionIndex === null ? '' : suggestionIndex) + '-' + suggestionIndex}
             onMouseEnter={this.onSuggestionMouseEnter.bind(this, sectionIndex, suggestionIndex)}
             onMouseLeave={this.onSuggestionMouseLeave}
             onMouseDown={this.onSuggestionMouseDown.bind(this, suggestion)}>
          {suggestionContent}
        </div>
      );
    }, this);
  },
  renderSuggestions: function() {
    if ((this.state.value === '' && !this.props.suggestForEmptyQuery)
      || this.state.suggestions === null) {
      return null;
    }

    var content;

    if (this.multipleSections) {
      content = this.state.suggestions.map(function(section, sectionIndex) {
        var sectionName = section.sectionName ? (
          <div className="react-autosuggest__suggestions-section-name">
            {section.sectionName}
          </div>
        ) : null;

        return section.suggestions.length === 0 ? null : (
          <div className="react-autosuggest__suggestions-section"
          key={'section-' + sectionIndex}>
            {sectionName}
            {this.renderSuggestionsList(section.suggestions, sectionIndex)}
          </div>
        );
      }, this);
    } else {
      content = this.renderSuggestionsList(this.state.suggestions, null);
    }

    return (
      <div id={'react-autosuggest-' + this.id}
           className="react-autosuggest__suggestions"
           role="listbox">
        {content}
      </div>
    );
  },
  render: function() {
    var ariaActivedescendant =
      this.getSuggestionId(this.state.focusedSectionIndex, this.state.focusedSuggestionIndex);

    return (
      <div className="react-autosuggest">
        <input {...this.props.inputAttributes}
               type="text"
               value={this.state.value}
               autoComplete="off"
               role="combobox"
               aria-autocomplete="list"
               aria-owns={'react-autosuggest-' + this.id}
               aria-expanded={this.state.suggestions !== null}
               aria-activedescendant={ariaActivedescendant}
               ref="input"
               onFocus={this.onInputFocus}
               onChange={this.onInputChange}
               onKeyDown={this.onInputKeyDown}
               onBlur={this.onInputBlur} />
        {this.renderSuggestions()}
      </div>
    );
  }
});

module.exports = Autosuggest;
