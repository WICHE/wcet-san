import React from "react";

function FilterItem(props) {
  return (
    <option value={ props.item.name } selected={ props.selected }>
      { props.item.name }
    </option>
  )
}

export default FilterItem
