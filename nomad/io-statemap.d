#!/usr/sbin/dtrace -Cs

/*
 * Copyright 2018, Joyent, Inc.
 */

#pragma D option quiet
#pragma D option destructive

#define STATE_METADATA(_state, _str, _color) \
	printf("\t\t\"%s\": {\"value\": %d, \"color\": \"%s\" }%s\n", \
	    _str, _state, _color, _state < 6 ? "," : "");

BEGIN
{
	wall = walltimestamp;
	printf("{\n\t\"start\": [ %d, %d ],\n",
	    wall / 1000000000, wall % 1000000000);
	printf("\t\"title\": \"disk I/O\",\n");
	printf("\t\"host\": \"%s\",\n", "Michael Macbook");
	printf("\t\"states\": {\n");

	STATE_METADATA(0, "4096 bcount", "#FEFF40")
	STATE_METADATA(1, "8192", "#DFE500");
	STATE_METADATA(2, "12288", "#DDD800");
	STATE_METADATA(3, "16384-20480", "#DBCC01");
	STATE_METADATA(4, "24576-36864", "#D9C002");
	STATE_METADATA(5, "40960-69642", "#D8B403");
	STATE_METADATA(6, ">69632", "#D6A804");

	printf("\t}\n}\n");
	start = timestamp;
}

io:::start
/!itagged[pid]/
{
  itagged[pid] = 1;

	this->b = (struct buf *)arg0;
  this->s = this->b->b_bcount / 4096;
  this->state = this->s == 1 ? 0 :
      this->s == 2 ? 1 :
      this->s == 3 ? 2 :
      this->s > 3 && this->s <= 5 ? 3 :
      this->s > 5 && this->s <= 9 ? 4 :
      this->s > 9 && this->s <= 17 ? 5 : 6;

  printf("{ \"state\": %d, \"tag\": \"%d\", \"process\": \"%s\" }",
      this->state,
      pid,
      execname);
}

io:::start
{
	this->b = (struct buf *)arg0;
  this->s = this->b->b_bcount / 4096;

	printf("{ \"time\": \"%d\", \"entity\": \"cpu%d\", \"state\": %d, \"tag\": \"%d\" }\n",
	    timestamp - start,
      cpu,
      this->s == 1 ? 0 :
      this->s == 2 ? 1 :
      this->s == 3 ? 2 :
      this->s > 3 && this->s <= 5 ? 3 :
      this->s > 5 && this->s <= 9 ? 4 :
      this->s > 9 && this->s <= 17 ? 5 : 6,
      pid);
}

/*
sdintr:entry
{
	this->b = (struct buf *)args[0]->pkt_private;
	self->un = ((struct sd_xbuf *)this->b->b_private)->xb_un;
}

sdintr:return
/(this->u = self->un) != NULL/
{
	printf("{ \"time\": \"%d\", \"entity\": \"sd%d\", \"state\": %d }\n",
	    timestamp - start,
	    ((struct dev_info *)this->u->un_sd->sd_dev)->devi_instance,
	    this->u->un_ncmds_in_transport < STATE_MAXIO ?
	    this->u->un_ncmds_in_transport : STATE_MAXIO);

	self->un = NULL;
}
*/

/*
tick-1
/timestamp - start > 10 * 1000000000/
{
	exit(0);
}
*/
