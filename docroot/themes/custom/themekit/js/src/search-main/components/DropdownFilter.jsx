import React from "react";
import FilterItem from "./FilterItem";

class DropdownFilter extends React.Component {
  constructor(props) {
    super(props);
    this.handleChange = this.handleChange.bind(this)
  }

  handleChange = (e) => {
    const facetName = this.props.item.name;
    const value = e.target.value;
    this.props.updateFilter(facetName, value);
  };

  render() {
    const filterItems = this.props.item.options ? this.props.item.options.map(item => {
      return (
        <FilterItem
          key={ item.name }
          item={ item }
        />
      )
    }) : [];

    return (
      <div className={`filter type-${ this.props.item.name }`}>
        <div className="filter-list" id={`toggle-${ this.props.item.name }`}>
          <select onChange={ this.handleChange }>
            <option value="">{ this.props.item.label }</option>
            { filterItems }
          </select>
        </div>
      </div>
    )
  }
}

export default DropdownFilter
