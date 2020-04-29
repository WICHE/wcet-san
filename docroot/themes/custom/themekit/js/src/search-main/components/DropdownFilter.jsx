import React from "react";
import FilterItem from "./FilterItem";

class DropdownFilter extends React.Component {
  constructor(props) {
    super(props);
    this.handleChange = this.handleChange.bind(this)
  }

  handleChange = (facetName, value) => {
    this.props.updateFilter(facetName, value);
  };

  render() {
    const filterItems = this.props.item.options ? this.props.item.options.map(item => {
      return (
        <FilterItem
          key={ item.name }
          item={ item }
          facetName={ this.props.item.name }
          selected={ this.props.item.selected === item.name }
        />
      )
    }) : [];

    // @TODO decode selected item from encoded value of searchResults

    return (
      <div className={`filter type-${ this.props.item.name }`}>
        <div className="filter-list" id={`toggle-${ this.props.item.name }`}>
          <label>{ this.props.item.label }:</label>
          <select onChange={ (e) => this.handleChange(this.props.item.name, e.target.value) }>
            <option value="">All { this.props.item.label }</option>
            { filterItems }
          </select>
        </div>
      </div>
    )
  }
}

export default DropdownFilter
