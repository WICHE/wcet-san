import $ from "jquery";

// Append a single filter row instead of two separate rows
$('.paragraph--type--table-with-filters table thead').append('<tr id="filterRow"></tr>');

let columns = $(".paragraph--type--table-with-filters thead tr:first th").length;
let filterRow = "";

for (let i = 0; i < columns; i++) {
    if (i === 0) {
        // First column has a search input instead of a dropdown
        filterRow += `<th><input type="text" class="column-search" data-column="${i}" placeholder="Search"></th>`;
    } else {
        // Other columns have dropdown filters
        filterRow += `<th><select class="column-filter" data-column="${i}"></select></th>`;
    }
}

$('#filterRow').html(filterRow);

function populateFilters() {
    $('.column-filter').each(function () {
        let column = $(this).data('column');
        let uniqueValues = [...new Set($('.paragraph--type--table-with-filters tbody tr').map(function () {
            return $(this).find("td").eq(column).text().trim();
        }).get())];

        let options = '<option value="">All</option>';
        uniqueValues.sort(); // Sort dropdown values alphabetically
        uniqueValues.forEach(value => {
            options += `<option value="${value}">${value}</option>`;
        });
        $(this).html(options);
    });
}

// Function to sort table by column 1 (index 0)
function sortTableByColumn1() {
    let rows = $('.paragraph--type--table-with-filters tbody tr').get();

    rows.sort((a, b) => {
        let A = $(a).find("td").eq(0).text().trim().toLowerCase();
        let B = $(b).find("td").eq(0).text().trim().toLowerCase();
        return A.localeCompare(B);
    });

    // Append rows in sorted order
    $.each(rows, function (index, row) {
        $('.paragraph--type--table-with-filters tbody').append(row);
    });
}

// Populate filters and sort table initially
populateFilters();
sortTableByColumn1();

function filterTable() {
    $('.paragraph--type--table-with-filters tbody tr').each(function () {
        let row = $(this);
        let showRow = true;

        $('.column-search').each(function () {
            let column = $(this).data('column');
            let value = $(this).val().toLowerCase();
            let cell = row.find("td").eq(column).text().toLowerCase();
            if (value && !cell.includes(value)) {
                showRow = false;
            }
        });

        $('.column-filter').each(function () {
            let column = $(this).data('column');
            let value = $(this).val();
            let cell = row.find("td").eq(column).text().trim();
            if (value && cell !== value) {
                showRow = false;
            }
        });

        row.toggle(showRow);
    });
}

// Event listeners
$('.column-search').on('keyup', filterTable);
$('.column-filter').on('change', filterTable);
