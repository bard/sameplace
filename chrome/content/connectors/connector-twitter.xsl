<?xml version="1.0" encoding="ISO-8859-1"?>
<xsl:stylesheet version="1.0"
                xmlns:xsl="http://www.w3.org/1999/XSL/Transform"
                xmlns:x4m="http://hyperstruct.net/xmpp4moz"
                xmlns:twitter="http://hyperstruct.net/xmpp4moz/connectors#twitter">

<xsl:param name="service_jid"/>

<xsl:output method='xml' version='1.0' encoding='UTF-8' indent='yes'/>

<xsl:template match="/">
  <stream>
    <xsl:apply-templates/>
  </stream>
</xsl:template>

<xsl:template match="users">
  <iq type="result">
    <query xmlns="jabber:iq:roster">
      <xsl:for-each select="user">
        <item subscription="to">
          <xsl:attribute name="jid"><xsl:value-of select="screen_name"/>@<xsl:value-of select="$service_jid"/></xsl:attribute>
          <xsl:attribute name="name">
            <xsl:value-of select="name"/>
          </xsl:attribute>
        </item>
      </xsl:for-each>
    </query>
  </iq>

  <xsl:for-each select="user">
    <iq type="result">
      <xsl:attribute name="from"><xsl:value-of select="screen_name"/>@<xsl:value-of select="$service_jid"/></xsl:attribute>
      <vCard xmlns="vcard-temp">
        <PHOTO>
          <EXTVAL>
            <xsl:value-of select="profile_image_url"/>
          </EXTVAL>
        </PHOTO>
      </vCard>
    </iq>    
  </xsl:for-each>
</xsl:template>

<xsl:template name="status">
  <presence>
    <xsl:attribute name="from"><xsl:value-of select="user/screen_name"/>@<xsl:value-of select="$service_jid"/>/<xsl:value-of select="source"/></xsl:attribute>
    <twitter:avatar-url>
      <xsl:value-of select="user/profile_image_url"/>
    </twitter:avatar-url>
    <delay xmlns="urn:xmpp:delay">
      <xsl:value-of select="created_at"/>
    </delay>
    <status>
      <xsl:value-of select="text"/>
    </status>
    <x xmlns="vcard-temp:x:update">
      <photo>12345</photo>
    </x>
  </presence>
</xsl:template>

<xsl:template match="status">
  <xsl:call-template name="status"/>
</xsl:template>

<xsl:template match="statuses">
  <xsl:for-each select="status[not(user/name = preceding-sibling::status/user/name)]">
    <xsl:call-template name="status"/>
  </xsl:for-each>
</xsl:template>
</xsl:stylesheet>
