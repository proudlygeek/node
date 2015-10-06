var client = algoliasearch('E5KERA8ZVY', '488f2cfbe85e7d906ec1070b02a40a54')
    index  = client.initIndex('NodeJSDoc_dev');

var d = document,
    searchIsInitialized = false,
    searchWrapper = '#search-wrapper',
    searchBox  = '#search',
    cancelBtn  = '.search-wrapper__icon',
    toc        = '#toc',
    docContent = '#apicontent',
    breadcrumb = '.type--left';

var ac = autocomplete(searchBox, { hint: true, debug: true }, [
  {
    source: autocomplete.sources.hits(index, { hitsPerPage: 5 }),
    templates: {
      empty: function(data) {
        return '<div class="no-results">We didn\'t find any results for "' + data.query + '". Sorry!</div>';
      },
      suggestion: function(suggestion) {
        var stability = (suggestion.isStable) ? 'stable' : 'deprecated';
        var showDescription = (suggestion._highlightResult.textValue.matchedWords.length) ? false : true;
        var breadcrumb = suggestion.breadcrumb || '';

        var description = (showDescription) ? (
          '<div class="type__description">' +
            (suggestion._snippetResult && 
             suggestion._snippetResult.description && 
             suggestion._snippetResult.description.value) +
          '</div>'
        ) : '';

        return (
          '<div class="type">' +
              '<div class="type__breadcrumb">' + breadcrumb + '</div>' +
              '<div class="type__title type--' + suggestion.type + ' stability stability--' + stability + '">' + 
                suggestion._highlightResult.textValue.value + 
              '</div>' + 
              description +
          '</div>'
        );
      },
      footer: '<div class="footer"></div>'
    }
  }
])
.on('autocomplete:selected', jumpToLocation)
.on('autocomplete:closed', showContent);

function autocompleteStart(e) {
  if (e.which === 27) return;
  
  if (e.target.value !== '') {
    showDeleteBtn();
    hideContent();
  } else {
    showContent();
  }
}

function showDeleteBtn() {
  if (ac.autocomplete.getVal() !== '') {
    $(searchWrapper).addClass('search-wrapper--not-empty');
  }
}

function hideContent() {
  $(toc).css('opacity', 0.1);
  $(docContent).css('opacity', 0.1);
}

function showContent() {
  $(searchWrapper).removeClass('search-wrapper--not-empty');
  $(toc).css('opacity', 1);
  $(docContent).css('opacity', 1);
}

function jumpToLocation(_, suggestion) {
  showContent();
  window.location = suggestion.link;
}

function cancelSearchText() {
  if ($(searchWrapper).hasClass('search-wrapper--not-empty')) {
    ac.autocomplete.setVal('');
    showContent();
  }
}

function onBreadcrumbClick(e) {
  e.preventDefault();
  jumpToLocation(e, { 
    link: $(e.target).attr('data-href')
  });
}

$(searchBox)
  .on('keyup', autocompleteStart)
  .on('focusin', showDeleteBtn);

$(cancelBtn).on('mousedown', cancelSearchText);

$('.aa-dropdown-menu').on('click', breadcrumb, onBreadcrumbClick);
