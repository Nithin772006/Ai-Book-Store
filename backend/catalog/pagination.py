from rest_framework.pagination import PageNumberPagination


class StandardResultsSetPagination(PageNumberPagination):
    """
    Standard page-number pagination for the public book catalogue.
    Default page size is 12 books per page, customizable up to 50 items.
    """
    page_size = 12
    page_size_query_param = 'page_size'
    max_page_size = 50
