from django.views.generic import DetailView, ListView

from .models import Ticket


class TicketListView(ListView):
    model = Ticket
    context_object_name = "tickets"
    template_name = "tickets/ticket_list.html"


class TicketDetailView(DetailView):
    model = Ticket
    context_object_name = "ticket"
    template_name = "tickets/ticket_detail.html"

    def get_context_data(self, **kwargs):
        context = super().get_context_data(**kwargs)
        context["comments"] = self.object.comments.all()
        return context
