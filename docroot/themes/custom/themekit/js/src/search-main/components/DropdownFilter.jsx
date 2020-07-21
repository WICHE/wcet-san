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

    return (
      <div className={`filter type-${ this.props.item.name }`}>
        <div className="filter-list" id={`toggle-${ this.props.item.name }`}>
          <label>{ this.props.item.label }:</label>

          <select onChange={ (e) => this.handleChange(this.props.item.name, e.target.value) } defaultValue={this.props.item.selected}>
            <option value="" selected="">All Resource Types</option>
            <option value="article">Article</option>
            <option value="article (wcet frontiers)">Article (WCET Frontiers)</option>
            <option value="coordinator call">Coordinator Call</option>
            <option value="enewsletter">eNewsletter</option>
            <option value="research">Research</option>
            <option value="talking points (white papers)">Talking Points (White Papers)</option>
            <option value="past webinars, events &amp; podcasts">Past Webinars, Events & Podcasts</option>
          </select>
        </div>
      </div>
    )
  }
}

export default DropdownFilter
